import dayjs, { Dayjs } from 'dayjs';
import { CellObject, SSF, WorkSheet, utils } from 'xlsx';
import { FilePayload } from './types';

export const config = {
  dataSheet: 'ЖОРР',
  dataBaseSheet: 'Частоти',
  networksDataBase: 'Знаряддя',
  dataSheetConfig: {
    dateCollName: 'B',
    timeCollName: 'C',
    whoCollName: 'D',
    whomCollName: 'E',
    frequencyCollName: 'F',
    dataStartRow: 3,
  },
  dataBaseConfig: {
    networkName: 'B',
    frequency: 'A',
  },
  detalization: {
    day: {
      format: 'DD.MM.YYYY',
    },
    hour: {
      format: 'DD.MM.YYYY HH:mm',
    },
    minute: {
      format: 'DD.MM.YYYY HH:mm',
    },
  },
};

const EMPTY_CS = 'н/в';

import CryptoJS from 'crypto-js';
import { addDays, addHours, addMinutes } from 'date-fns';

function hashString(str: string) {
  return CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex);
}

export type Placeholders = Record<string, ChartDataItem>;

export type Detelization = 'day' | 'hour' | 'minute';

export type FrequencyData = {
  date: Dayjs;
  who?: string;
  whom?: string;
  frequency?: number;
};

export type NetworkData = {
  sourceFileHash: string;
  originalName: string;
  frequencies: number[];
  idHash: string;
};

export type NetworkName = {
  id: string;
  name: string;
  amountInterceptions: number;
};

export type ChartDataItem = { key: string; count: number };

export type ChartData = Placeholders;

class DataParser {
  private Sheets: Record<string, { [sheet: string]: WorkSheet }> = {};
  private networkNameToFrequncyMap: Record<string, NetworkData> = {};
  private groupedFrequenciesData: Record<string, FrequencyData[]> = {};
  private fileNameToIdMap: Record<string, string> = ({} = {});
  private result: (NetworkData & { frequencyData: FrequencyData[] })[] = [];
  private minDate: Dayjs;
  public detalization: Detelization = 'day';

  public placeholders: Placeholders = {};

  private hasThisFile(options: { fileName: string; hash: string }): boolean {
    return !!this.fileNameToIdMap[options.hash];
  }

  private setFileAsRead(options: { fileName: string; hash: string }) {
    this.fileNameToIdMap[options.hash] = options.fileName;
  }

  set setDetalization(detalization: Detelization) {
    this.detalization = detalization;
  }

  private mergeFrequenciesOfDifferentFiles() {
    const hashes = Object.keys(this.fileNameToIdMap);
    const len = hashes.length;
    for (let i = 0; i < len; i++) {
      const hash = hashes[i];
      const frequenciesDatabaseSheet = this.Sheets[hash][config.dataBaseSheet];
      const {
        e: { r },
      } = utils.decode_range(frequenciesDatabaseSheet['!ref']!);

      for (let i = 2; i < r; i++) {
        const networkNameCellKey = `${config.dataBaseConfig.networkName}${i}`;
        const frequncyCellKey = `${config.dataBaseConfig.frequency}${i}`;
        const originalName =
          frequenciesDatabaseSheet[networkNameCellKey]?.v?.trim();
        if (!originalName) {
          console.warn(`Invalid network name in row ${i}`);
          continue;
        }
        const hashName = hashString(originalName);
        const networkData = this.networkNameToFrequncyMap[hashName] || {
          originalName,
          idHash: hashName,
          sourceFileHash: hash,
          frequencies: [],
        };

        const frequency: number = frequenciesDatabaseSheet[frequncyCellKey]?.v;
        if (!networkData.frequencies.includes(frequency)) {
          networkData.frequencies = [...networkData.frequencies, frequency];
          this.networkNameToFrequncyMap[hashName] = networkData;
        }
      }
    }
  }

  private groupDataByFrequency() {
    const hashes = Object.keys(this.fileNameToIdMap);
    const len = hashes.length;
    this.groupedFrequenciesData = {};
    for (let i = 0; i < len; i++) {
      const hash = hashes[i];
      const mainContent = this.Sheets[hash][config.dataSheet];
      const {
        e: { r },
      } = utils.decode_range(mainContent['!ref']!);

      for (let k = 0; k < r; k++) {
        const frequncyCellKey = `${config.dataSheetConfig.frequencyCollName}${k}`;
        const freqValue: number | undefined = +mainContent[frequncyCellKey]?.v;

        if (freqValue && !isNaN(freqValue)) {
          const prev = this.groupedFrequenciesData[freqValue] || [];

          const dateCellKey = `${config.dataSheetConfig.dateCollName}${k}`;
          const timeCellKey = `${config.dataSheetConfig.timeCollName}${k}`;
          const date: CellObject | undefined = mainContent[dateCellKey];
          const time: CellObject | undefined = mainContent[timeCellKey];

          if (
            typeof date?.v === 'number' &&
            typeof time?.v === 'number' &&
            +date.v >= 0 &&
            +time.v >= 0
          ) {
            const dateData = this.convertExcelDateToJsDate(
              date.v as number,
              time.v as number
            );

            const whoCellKey = `${config.dataSheetConfig.whoCollName}${k}`;
            const whomCellKey = `${config.dataSheetConfig.whomCollName}${k}`;
            const whoCell: CellObject | undefined = mainContent[whoCellKey];
            const whomCell: CellObject | undefined = mainContent[whomCellKey];

            this.groupedFrequenciesData[freqValue] = [
              ...prev,
              {
                date: dateData,
                who: (whoCell?.v as string) || EMPTY_CS,
                whom: (whomCell?.v as string) || EMPTY_CS,
                frequency: freqValue,
              },
            ];
          }
        }
      }
    }
  }

  public init(
    content: FilePayload,
    options: { fileName: string; hash: string }
  ) {
    if (!this.hasThisFile(options)) {
      this.setFileAsRead(options);
    } else {
      alert('This version on file has been read');
      return;
    }
    this.Sheets = {
      ...this.Sheets,
      [options.hash]: content.Sheets,
    };

    this.mergeFrequenciesOfDifferentFiles();
    this.groupDataByFrequency();
  }

  private setFilterData(filters: {
    range: [Dayjs, Dayjs];
    specFilters: Record<
      string,
      {
        frequencies: (number | undefined)[];
        callsigns: {
          who: Array<string | undefined>;
          whom: Array<string | undefined>;
        };
      }
    >;
  }): (NetworkData & { frequencyData: FrequencyData[] })[] {
    const entries: {
      sourceFileHash: string;
      originalName: string;
      frequencies: number[];
      idHash: string;
    }[] = Object.values(this.networkNameToFrequncyMap);
    return entries.reduce<(NetworkData & { frequencyData: FrequencyData[] })[]>(
      (acc, curr) => {
        const frequencyData = curr.frequencies
          .map((fr) => {
            return this.filter({
              raw: this.groupedFrequenciesData[fr] || [],
              range: filters.range,
              specFilters: filters.specFilters[curr.idHash],
            });
          })
          .flat();

        return [...acc, { ...curr, frequencyData }];
      },
      []
    );
  }

  public onFilter(
    filters: {
      range: [Dayjs, Dayjs];
      specFilters: Record<
        string,
        {
          frequencies: (number | undefined)[];
          callsigns: {
            who: Array<string | undefined>;
            whom: Array<string | undefined>;
          };
        }
      >;
    },
    detalization: Detelization
  ) {
    this.result = this.setFilterData(filters);
    this.placeholders = this.getPlaceholders({
      range: filters.range,
      detalization,
    });
  }

  getMinDate() {
    const hashes = Object.keys(this.fileNameToIdMap);
    const len = hashes.length;
    let date: Dayjs = dayjs();
    for (let i = 0; i < len; i++) {
      const hash = hashes[i];

      const dateCellKey = `${config.dataSheetConfig.dateCollName}3`;
      const xslxDate: number =
        this.Sheets[hash][config.dataSheet][dateCellKey].v;

      if (xslxDate && typeof xslxDate === 'number') {
        const dateData = this.convertExcelDateToJsDate(xslxDate, 0);
        if (date.valueOf() > dateData.valueOf()) {
          date = dateData;
        }
      }
    }

    return date;
  }

  private convertExcelDateToJsDate(xDate: number, xTime: number) {
    const { y, m, d, H, M } = SSF.parse_date_code(xDate + xTime);

    return dayjs(new Date(y, m - 1, d, H, M));
  }

  public getNetworkData(networkId: string):
    | undefined
    | {
        chartData: ChartData;
        networkId: string;
        name: string;
        maxY: number;
        frequencies: number[];
        callsigns: {
          who: Array<string | undefined>;
          whom: Array<string | undefined>;
        };
      } {
    const networkData = this.result.find(({ idHash }) => idHash === networkId);

    if (!networkData) {
      alert(`Ups! Soething went wrong for id: ${networkId}`);
      return;
    }

    const chartData = networkData.frequencyData.reduce((acc, curr) => {
      let dateKey = curr.date;

      if (this.detalization === 'day') {
        dateKey = curr.date.startOf('day');
      } else if (this.detalization === 'hour') {
        dateKey = curr.date.startOf('hour');
      } else {
        dateKey = curr.date.startOf('minute');
      }
      const dateKeyStr = dateKey.format(
        config.detalization[this.detalization].format
      );

      if (typeof acc[dateKeyStr]?.count !== 'number') {
        return acc;
      }

      return {
        ...acc,
        [dateKeyStr]: {
          key: dateKeyStr,
          count: acc[dateKeyStr].count + 1,
        },
      };
    }, this.placeholders);

    const maxY = Math.max(
      ...Object.values(chartData).map(({ count }) => count)
    );

    const cs: {
      who: Array<string | undefined>;
      whom: Array<string | undefined>;
    } = networkData.frequencies.reduce(
      (
        acc: {
          who: Array<string | undefined>;
          whom: Array<string | undefined>;
        },
        curr
      ) => {
        const frData = this.groupedFrequenciesData[curr];
        if (!frData) return acc;

        const callsigns: {
          who: Array<string | undefined>;
          whom: Array<string | undefined>;
        } = frData.reduce(
          (
            acc: {
              who: Array<string | undefined>;
              whom: Array<string | undefined>;
            },
            curr
          ) => {
            const who = curr.who?.toString()?.trim();
            const whom = curr.whom?.toString()?.trim();

            if (!acc.who.includes(who)) acc.who.push(who);
            if (!acc.whom.includes(whom)) acc.whom.push(whom);

            return acc;
          },
          { who: [], whom: [] }
        );

        return {
          who: [...new Set([...acc.who, ...callsigns.who])],
          whom: [...new Set([...acc.whom, ...callsigns.whom])],
        };
      },
      { who: [], whom: [] }
    );

    return {
      chartData,
      networkId,
      maxY,
      name: networkData.originalName,
      frequencies: this.networkNameToFrequncyMap[networkId].frequencies,
      callsigns: cs,
    };
  }

  filter({
    range,
    raw,
    specFilters,
  }: {
    range: [Dayjs, Dayjs];
    raw: FrequencyData[];
    specFilters: {
      frequencies: (number | undefined)[];
      callsigns: {
        who: Array<string | undefined>;
        whom: Array<string | undefined>;
      };
    };
  }) {
    const stage1 = raw.filter(({ date }) => {
      const inRange =
        date.valueOf() >= range[0].valueOf() &&
        date.valueOf() <= range[1].valueOf();

      return inRange;
    });

    const specCallsignsWho = specFilters?.callsigns?.who || [];
    const specCallsignsWhom = specFilters?.callsigns?.whom || [];
    const specFreqs = specFilters?.frequencies || [];

    const stage2 = specCallsignsWho?.length
      ? stage1.filter(({ who }) => specCallsignsWho.includes(who))
      : stage1;

    const stage3 = specCallsignsWhom?.length
      ? stage2.filter(({ whom }) => specCallsignsWhom.includes(whom))
      : stage2;

    const stage4 = specFreqs?.length
      ? stage3.filter(({ frequency }) => specFreqs.includes(frequency))
      : stage3;

    return stage4;
  }

  getPlaceholders({
    detalization,
    range,
  }: {
    detalization: Detelization;
    range: [Dayjs, Dayjs];
  }): Placeholders {
    const diff = range[1].diff(range[0], detalization);
    const modifier =
      detalization === 'day'
        ? addDays
        : detalization === 'hour'
        ? addHours
        : addMinutes;

    const emptyValues = {} as Placeholders;
    for (let i = 0; i <= diff; i++) {
      const dateKeyStr =
        detalization !== 'minute'
          ? dayjs(modifier(range[0].set('minute', 0).toDate(), i))?.format(
              config.detalization[detalization as string].format
            )
          : dayjs(modifier(range[0].set('second', 0).toDate(), i))?.format(
              config.detalization[detalization as string].format
            );

      emptyValues[dateKeyStr] = { key: dateKeyStr, count: 0 };
    }

    return emptyValues;
  }

  getNetworkNames(): NetworkName[] {
    return this.result
      .map(({ idHash, originalName, frequencyData }) => {
        return {
          id: idHash,
          name: originalName,
          amountInterceptions: frequencyData.length,
        };
      })
      .sort((a, b) => b.amountInterceptions - a.amountInterceptions);
  }
}

export const dataParser = new DataParser();
