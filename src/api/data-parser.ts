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
    whoCollName: 'E',
    whomCollName: 'D',
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

const EMPTY_CALLSIGN = 'н/в';

import CryptoJS from 'crypto-js';
import { addDays, addHours, addMinutes } from 'date-fns';

function hashString(str: string) {
  return CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex);
}

export type Placeholders = Record<string, ChartDataItem>;

export type Detelization = 'day' | 'hour' | 'minute';

export type FrequencyData = {
  date: Dayjs;
  who: string;
  whom: string;
  connect: string;
  frequency: number;
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
  frequencyData: FrequencyData[];
};

export type ChartDataItem = { key: string; count: number };

export type ChartData = Placeholders;

type MainFilterProps = { range: [Dayjs, Dayjs] };

class DataParser {
  private Sheets: Record<string, { [sheet: string]: WorkSheet }> = {};
  private mapNetworkIdToNetworkInfo: Record<string, NetworkData> = {};
  private mapFrequencyToData: Record<string, FrequencyData[]> = {};
  private fileNameToIdMap: Record<string, string> = ({} = {});
  public detalization: Detelization = 'day';

  private mainStore: Record<string, FrequencyData[]> = {};

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

  private mainFilter(mainFilter: MainFilterProps, data: FrequencyData[]) {
    return data.filter(({ date }) => {
      const inRange =
        date.valueOf() >= mainFilter.range[0].valueOf() &&
        date.valueOf() <= mainFilter.range[1].valueOf();

      return inRange;
    });
  }

  private connectBuilder(who: string, whom: string): string {
    return `${who} => ${whom}`;
  }

  public onMainFilterChange(
    mainFilter: MainFilterProps,
    detalization: Detelization
  ) {
    const entries = Object.entries(this.mapFrequencyToData);
    const localMainStore = entries.map(([frequency, data]) => {
      const filtered = this.mainFilter(mainFilter, data);
      return [frequency, filtered];
    });

    this.mainStore = Object.fromEntries(localMainStore);
    this.placeholders = this.getPlaceholders({
      range: mainFilter.range,
      detalization,
    });
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
        const networkData = this.mapNetworkIdToNetworkInfo[hashName] || {
          originalName,
          idHash: hashName,
          sourceFileHash: hash,
          frequencies: [],
        };

        const frequency: number = frequenciesDatabaseSheet[frequncyCellKey]?.v;
        if (!networkData.frequencies.includes(frequency)) {
          networkData.frequencies = [...networkData.frequencies, frequency];
          this.mapNetworkIdToNetworkInfo[hashName] = networkData;
        }
      }
    }
  }

  private groupDataByFrequency() {
    const hashes = Object.keys(this.fileNameToIdMap);
    const len = hashes.length;
    this.mapFrequencyToData = {};
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
          const prev = this.mapFrequencyToData[freqValue] || [];

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

            const who = (whoCell?.v || EMPTY_CALLSIGN).toString().trim();
            const whom = (whomCell?.v || EMPTY_CALLSIGN).toString().trim();

            this.mapFrequencyToData[freqValue] = [
              ...prev,
              {
                date: dateData,
                who,
                whom,
                connect: this.connectBuilder(who, whom),
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

  private convertExcelDateToJsDate(xDate: number, xTime: number) {
    const { y, m, d, H, M } = SSF.parse_date_code(xDate + xTime);

    return dayjs(new Date(y, m - 1, d, H, M));
  }

  public getNetworkData(
    networkId: string,
    specFilters: {
      frequencies: Array<number>;
      who: Array<string>;
      whom: Array<string>;
      connect: Array<string>;
    }
  ): Promise<
    | undefined
    | {
        chartData: ChartData;
        networkId: string;
        name: string;
        maxY: number;
        frequencies: Record<string, number>;
        callsigns: {
          who: Record<string, number>;
          whom: Record<string, number>;
          connect: Record<string, number>;
        };
      }
  > {
    return new Promise((resolve) => {
      const networkInfo = this.mapNetworkIdToNetworkInfo[networkId];

      if (!networkInfo) {
        alert(`Ups! Soething went wrong for id: ${networkId}`);
        return;
      }

      const mergedDataByNetworkFrequencies: FrequencyData[] =
        networkInfo.frequencies
          .map((frequency) => this.mainStore[frequency])
          .filter(Boolean)
          .flat();

      const filtered = this.filter(specFilters, mergedDataByNetworkFrequencies);

      const frequencies: Record<string, number> = filtered.reduce(
        (acc, curr) => {
          const prevForCurrentFrequency = acc[curr.frequency] || 0;

          return {
            ...acc,
            [curr.frequency]: prevForCurrentFrequency + 1,
          };
        },
        {}
      );

      const callsigns: {
        who: Record<string, number>;
        whom: Record<string, number>;
        connect: Record<string, number>;
      } = filtered.reduce(
        (acc, curr) => {
          const who = curr.who || EMPTY_CALLSIGN;
          const whom = curr.whom || EMPTY_CALLSIGN;
          const prevWho = acc.who[who] || 0;
          const prevWhom = acc.whom[whom] || 0;
          const both = this.connectBuilder(who, whom);
          const prevBoth = acc.connect[both] || 0;

          acc.who[who] = prevWho + 1;
          acc.whom[whom] = prevWhom + 1;
          acc.connect[both] = prevBoth + 1;

          return acc;
        },
        {
          who: {},
          whom: {},
          connect: {},
        }
      );

      const chartData = filtered.reduce(
        (acc, curr) => {
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

          const newA = {
            key: dateKeyStr,
            count: acc[dateKeyStr].count + 1,
          };

          acc[dateKeyStr] = { ...newA };

          return acc;
        },
        { ...this.placeholders }
      );

      const maxY = Math.max(
        ...Object.values(chartData).map(({ count }) => count)
      );

      resolve({
        chartData,
        networkId,
        maxY,
        name: networkInfo.originalName,
        frequencies,
        callsigns,
      });
    });
  }

  private filter(
    specFilters: {
      frequencies: Array<number>;
      who: Array<string>;
      whom: Array<string>;
      connect: Array<string>;
    },
    raw: FrequencyData[]
  ) {
    const specCallsignsWho = specFilters?.who || [];
    const specCallsignsWhom = specFilters?.whom || [];
    const specCallsignsConnect = specFilters?.connect || [];
    const specFreqs = specFilters?.frequencies || [];

    const stage1 = specCallsignsWho?.length
      ? raw.filter(({ who }) => specCallsignsWho.includes(who))
      : raw;

    const stage2 = specCallsignsWhom?.length
      ? stage1.filter(({ whom }) => specCallsignsWhom.includes(whom))
      : stage1;

    const stage3 = specFreqs?.length
      ? stage2.filter(({ frequency }) => specFreqs.includes(frequency))
      : stage2;

    const stage4 = specCallsignsConnect?.length
      ? stage3.filter(({ connect }) => specCallsignsConnect.includes(connect))
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
    return Object.entries(this.mapNetworkIdToNetworkInfo)
      .map(([networkId, { frequencies, originalName }]) => {
        const filteredFrequencyData = frequencies
          .map((fr) => this.mainStore[fr] || [])
          .flat();

        return {
          id: networkId,
          name: originalName,
          amountInterceptions: filteredFrequencyData.length,
          frequencyData: filteredFrequencyData,
        };
      })
      .sort((a, b) => b.amountInterceptions - a.amountInterceptions);
  }
}

export const dataParser = new DataParser();
