import { addDays, addHours, addMinutes } from 'date-fns';
import dayjs, { Dayjs } from 'dayjs';
import { CellObject, SSF, WorkSheet, utils } from 'xlsx';
import { FilePayload } from './types';

const config = {
  dataSheet: 'ЖОРР',
  dataBaseSheet: 'Частоти',
  dataSheetConfig: {
    json: {
      frequency: '_4',
      callsign: {
        who: '_2',
        whoom: '_3',
      },
    },
    dateCollName: 'B',
    timeCollName: 'C',
    frequencyCollName: 'F',
    dataStartRow: 3,
    callsign: {
      who: 'D',
      whoom: 'E',
    },
  },
  dataBaseConfig: {
    json: {
      networkName: 'Назва Р/М',
      frequency: 'Частоти',
    },
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

export type ChartItemType = { key: string; count: number };
export type DatabaseJsonRow = { 'Назва Р/М': string; Частоти: number };
export type ZhorrJsonRow = { frequency: number; who: string; whoom: string };

export type ChartDataType = {
  [key: string]: ChartItemType;
};

export type SheetAnalysisResultType = {
  fullName: string;
  data: ChartItemType[];
};

export type Detelization = 'day' | 'hour' | 'minute';

export type TNetworkData = {
  frequencies: number[];
  callsigns: string[];
  name: string;
};

export type TNetworkDataMap = Record<string, TNetworkData>;

class DataParser {
  private data: FilePayload | null = null;
  private diff: number = 0;
  private range: [Dayjs, Dayjs] | [] = [];
  private detalization: Detelization = 'day';
  private networkNameToFrequncyMap: Record<string, number[]> = {};
  private networkDataMap: TNetworkDataMap = {};

  init(content: FilePayload) {
    this.data = content;
  }

  get sheetNames() {
    return this.data?.SheetNames || [];
  }

  getMinDate() {
    if (!this.data) {
      return;
    }

    const dateCellKey = `${config.dataSheetConfig.dateCollName}3`;
    const xslxDate: number = this.data.Sheets[config.dataSheet][dateCellKey].v;

    if (xslxDate && typeof xslxDate === 'number') {
      const dateData = this.convertExcelDateToJsDate(xslxDate, 0);
      return dateData;
    }

    return;
  }

  private convertExcelDateToJsDate(xDate: number, xTime: number) {
    const { y, m, d, H, M } = SSF.parse_date_code(xDate + xTime);

    return dayjs(new Date(y, m - 1, d, H, M));
  }

  getNetworkData(): TNetworkData[] {
    if (!this.data) {
      return [];
    }
    const database = this.data.Sheets[config.dataBaseSheet];
    const zhorr = this.data.Sheets[config.dataSheet];

    if (!database || !zhorr) {
      alert(`${config.dataBaseSheet} or ${config.dataSheet} not found`);

      return [];
    }

    const databaseJsonSheet: DatabaseJsonRow[] = utils.sheet_to_json(database);
    const zhorrJsonSheet: ZhorrJsonRow[] = utils.sheet_to_json(zhorr, {
      header: ['id', 'date', 'time', 'who', 'whoom', 'frequency'],
    });

    for (const row of databaseJsonSheet) {
      const networkName = row[config.dataBaseConfig.json.networkName]?.trim();

      if (!networkName) {
        console.warn(row, 'Not valid network name');
        continue;
      }
      const frequency = row[config.dataBaseConfig.json.frequency];

      if (!this.networkDataMap[networkName]) {
        this.networkDataMap[networkName] = {
          frequencies: [],
          callsigns: [],
          name: networkName,
        };
      }
      const newFrequencies = [
        ...new Set([
          ...this.networkDataMap[networkName].frequencies,
          frequency,
        ]),
      ];

      this.networkDataMap[networkName].frequencies = newFrequencies;
    }

    const clearZhorrRows = zhorrJsonSheet.filter(
      ({ frequency }) => !!frequency
    );

    clearZhorrRows.forEach(({ frequency, who, whoom }) => {
      let callsigns =
        !who && !whoom
          ? ['empty']
          : who && whoom
          ? [who, whoom]
          : who
          ? [who]
          : [whoom];

      callsigns = callsigns.map((cs) => {
        return cs.toString().trim();
      });
      const matchByFrequncy = Object.values(this.networkDataMap).filter(
        ({ frequencies }) => frequencies.includes(frequency)
      );

      matchByFrequncy.forEach(({ name }) => {
        const newCallsigns = [
          ...this.networkDataMap[name].callsigns,
          ...callsigns,
        ];

        this.networkDataMap[name].callsigns = [...new Set(newCallsigns)];
      });
    });

    return Object.values(this.networkDataMap);
  }

  analyzeSheet(
    networkName: string,
    range: [Dayjs, Dayjs],
    detalization: Detelization
  ): SheetAnalysisResultType {
    if (!this.data)
      return {
        data: [],
        fullName: '',
      };

    const sheetData = this.data.Sheets[config.dataSheet];
    const frequencies = this.networkNameToFrequncyMap[networkName];

    const fullName = networkName;

    const data = this.getDateTimeData(
      sheetData,
      range,
      detalization,
      frequencies
    );

    return {
      data,
      fullName,
    };
  }

  getDateTimeData(
    sheetData: WorkSheet,
    range: [Dayjs, Dayjs],
    detalization: Detelization,
    frequencies: number[]
  ): ChartItemType[] {
    const maxRow = Number(
      sheetData['!ref']?.split(':')[1].replace(new RegExp('[A-Z]*'), '')
    );
    const chartData: Dayjs[] = [];
    this.diff = range[1].diff(range[0], detalization);
    this.range = range;
    this.detalization = detalization;

    for (let i = config.dataSheetConfig.dataStartRow; i <= maxRow; i++) {
      const freqCellKey = `${config.dataSheetConfig.frequencyCollName}${i}`;
      const freq: CellObject | undefined = sheetData[freqCellKey];

      if (!freq?.v || !frequencies.includes(freq?.v as number)) continue;

      const dateCellKey = `${config.dataSheetConfig.dateCollName}${i}`;
      const timeCellKey = `${config.dataSheetConfig.timeCollName}${i}`;
      const date: CellObject | undefined = sheetData[dateCellKey];
      const time: CellObject | undefined = sheetData[timeCellKey];

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

        const matchRange = dateData > range[0] && dateData < range[1];

        if (matchRange) {
          chartData.push(dateData);
        }
      }
    }

    return this.groupForChart(chartData);
  }

  groupForChart(data: Dayjs[]): ChartItemType[] {
    const payload = data.reduce((acc: ChartDataType, curr) => {
      let dateKey: Dayjs = curr;

      if (this.detalization === 'day') {
        dateKey = curr
          .set('hour', 0)
          .set('minute', 0)
          .set('second', 0)
          .set('millisecond', 0);
      } else if (this.detalization === 'hour') {
        dateKey = curr.set('minute', 0).set('second', 0).set('millisecond', 0);
      } else if (this.detalization === 'minute') {
        dateKey = curr.set('second', 0).set('millisecond', 0);
      }

      const dateKeyStr = dateKey.format(
        config.detalization[this.detalization as string].format
      );

      const initDateData = { key: dateKeyStr, count: 0 };

      const existedDateData = acc[dateKeyStr] || initDateData;

      existedDateData.count = existedDateData.count + 1;

      return {
        ...acc,
        [dateKeyStr]: existedDateData,
      };
    }, {});

    const empty = this.fillEmptyData(Object.keys(payload));

    return Object.values({ ...empty, ...payload });
  }

  fillEmptyData(dataKeys: string[]) {
    const modifier =
      this.detalization === 'day'
        ? addDays
        : this.detalization === 'hour'
        ? addHours
        : addMinutes;
    const res = {};
    for (let i = 0; i <= this.diff; i++) {
      const dateKeyStr =
        this.detalization !== 'minute'
          ? dayjs(
              modifier(
                this.range[0]?.set('minute', 0)?.toDate() || new Date(),
                i
              )
            )?.format(config.detalization[this.detalization as string].format)
          : dayjs(
              modifier(
                this.range[0]?.set('second', 0)?.toDate() || new Date(),
                i
              )
            )?.format(config.detalization[this.detalization as string].format);

      res[dateKeyStr] = { key: dateKeyStr, count: 0 };
    }

    return res;
  }
}

export const dataParser = new DataParser();
