import { addDays, addHours, addMinutes } from 'date-fns';
import dayjs, { Dayjs } from 'dayjs';
import { CellObject, SSF, utils } from 'xlsx';
import { FilePayload } from './types';

const config = {
  dataSheet: 'ЖОРР',
  dataBaseSheet: 'Частоти',
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

export type ChartItemType = { key: string; count: number };

export type ChartDataType = {
  [key: string]: ChartItemType;
};

export type SheetAnalysisResultType = {
  fullName: string;
  data: ChartItemType[];
};

export type Detelization = 'day' | 'hour' | 'minute';

export type FrequencyData = {
  date: Dayjs;
  who?: string;
  whom?: string;
  frequency?: string;
};

class DataParser {
  private data: FilePayload | null = null;
  private diff: number = 0;
  private range: [Dayjs, Dayjs] | [] = [];
  private detalization: Detelization = 'day';
  private networkNameToFrequncyMap: Record<string, number[]> = {};
  private groupedFrequenciesData: Record<string, FrequencyData[]> = {};

  init(content: FilePayload) {
    if (!this.data) {
      this.data = content;
    } else {
      this.data = {
        SheetNames: [...this.data.SheetNames, ...content.SheetNames],
        Sheets: {
          ...this.data.Sheets,
          ...content.Sheets,
        },
      };
    }

    this.groupDataByFrequency();
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

  getSheetNames(): string[] {
    if (!this.data) {
      return [];
    }
    const database = this.data.Sheets[config.dataBaseSheet];

    const {
      e: { r },
    } = utils.decode_range(database['!ref']!);

    const names: string[] = [];

    for (let i = 2; i < r; i++) {
      const networkNameCellKey = `${config.dataBaseConfig.networkName}${i}`;
      const frequncyCellKey = `${config.dataBaseConfig.frequency}${i}`;
      let name = '';
      if (database[networkNameCellKey]) {
        name = database[networkNameCellKey]?.v?.trim();
        if (!name) {
          console.warn(`Invalid network name in row ${i}`);
          continue;
        }
        if (!names.includes(name)) {
          names.push(name);
        }
      }
      if (name) {
        const prev = this.networkNameToFrequncyMap[name] || [];
        const frequency: number = database[frequncyCellKey]?.v;
        if (!frequency) {
          console.warn(`Invalid freqency in row ${i}`);
          continue;
        }
        this.networkNameToFrequncyMap[name] = [
          ...new Set([...prev, frequency]),
        ];
      }
    }

    return names;
  }

  groupDataByFrequency() {
    if (!this.data) {
      console.error('No data found');
      return;
    }

    const source = this.data.Sheets[config.dataSheet];
    const {
      e: { r },
    } = utils.decode_range(source['!ref']!);

    const maxRow = source['!rows']?.length || r;

    const result: Record<string, FrequencyData[]> = {};

    for (let i = 0; i <= maxRow; i++) {
      const freqCellKey = `${config.dataSheetConfig.frequencyCollName}${i}`;
      const freqValue: string | undefined = source[freqCellKey]?.v?.toString();
      if (freqValue) {
        const prev = result[freqValue] || [];

        const dateCellKey = `${config.dataSheetConfig.dateCollName}${i}`;
        const timeCellKey = `${config.dataSheetConfig.timeCollName}${i}`;
        const date: CellObject | undefined = source[dateCellKey];
        const time: CellObject | undefined = source[timeCellKey];

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

          const whoCellKey = `${config.dataSheetConfig.whoCollName}${i}`;
          const whomCellKey = `${config.dataSheetConfig.whomCollName}${i}`;
          const freqCellKey = `${config.dataSheetConfig.frequencyCollName}${i}`;
          const whoCell: CellObject | undefined = source[whoCellKey];
          const whomCell: CellObject | undefined = source[whomCellKey];
          const freqCell: CellObject | undefined = source[freqCellKey];

          result[freqValue] = [
            ...prev,
            {
              date: dateData,
              who: whoCell?.v as string | undefined,
              whom: whomCell?.v as string | undefined,
              frequency: freqCell?.v as string | undefined,
            },
          ];
        }
      }
    }

    this.groupedFrequenciesData = result;
  }

  analyzeSheet(
    networkName: string,
    range: [Dayjs, Dayjs],
    detalization: Detelization
  ): SheetAnalysisResultType {
    if (!this.data) {
      return {
        data: [],
        fullName: '',
      };
    }

    this.detalization = detalization;
    this.diff = range[1].diff(range[0], detalization);
    this.range = range;

    const frequencies = this.networkNameToFrequncyMap[networkName];
    const frequenciesData = frequencies.map(
      (val) => this.groupedFrequenciesData[val.toString()] || []
    );
    const rawData = frequenciesData.flat();

    const filtered: FrequencyData[] = this.filter({
      raw: rawData,
      range,
    });

    const fullName = networkName;

    const data = this.groupForChart(filtered);

    return {
      data,
      fullName,
    };
  }

  filter({ range, raw }: { range: [Dayjs, Dayjs]; raw: FrequencyData[] }) {
    return raw.filter(({ date }) => {
      console.log(
        date.format('DD.MM.YYYY HH:mm'),
        range[0].format('DD.MM.YYYY HH:mm'),
        date.isAfter(range[0])
      );

      return (
        date.valueOf() >= range[0].valueOf() &&
        date.valueOf() <= range[1].valueOf()
      );
    });
  }

  groupForChart(data: FrequencyData[]): ChartItemType[] {
    const payload = data.reduce((acc: ChartDataType, curr) => {
      let dateKey: Dayjs = curr.date;

      if (this.detalization === 'day') {
        dateKey = curr.date
          .set('hour', 0)
          .set('minute', 0)
          .set('second', 0)
          .set('millisecond', 0);
      } else if (this.detalization === 'hour') {
        dateKey = curr.date
          .set('minute', 0)
          .set('second', 0)
          .set('millisecond', 0);
      } else if (this.detalization === 'minute') {
        dateKey = curr.date.set('second', 0).set('millisecond', 0);
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

    const empty = this.fillEmptyData();

    return Object.values({ ...empty, ...payload }).sort(
      (a, b) => dayjs(a.key).valueOf() - dayjs(b.key).valueOf()
    );
  }

  fillEmptyData() {
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

  // getDateTimeData(
  //   sheetData: WorkSheet,
  //   range: [Dayjs, Dayjs],
  //   detalization: Detelization,
  //   frequencies: number[]
  // ): ChartItemType[] {
  //   const maxRow = Number(
  //     sheetData['!ref']?.split(':')[1].replace(new RegExp('[A-Z]*'), '')
  //   );
  //   const chartData: Dayjs[] = [];
  //   this.diff = range[1].diff(range[0], detalization);
  //   this.range = range;
  //   this.detalization = detalization;

  //   for (let i = config.dataSheetConfig.dataStartRow; i <= maxRow; i++) {
  //     const freqCellKey = `${config.dataSheetConfig.frequencyCollName}${i}`;
  //     const freq: CellObject | undefined = sheetData[freqCellKey];

  //     if (!freq?.v || !frequencies.includes(freq?.v as number)) continue;

  //     const dateCellKey = `${config.dataSheetConfig.dateCollName}${i}`;
  //     const timeCellKey = `${config.dataSheetConfig.timeCollName}${i}`;
  //     const date: CellObject | undefined = sheetData[dateCellKey];
  //     const time: CellObject | undefined = sheetData[timeCellKey];

  //     if (
  //       typeof date?.v === 'number' &&
  //       typeof time?.v === 'number' &&
  //       +date.v >= 0 &&
  //       +time.v >= 0
  //     ) {
  //       const dateData = this.convertExcelDateToJsDate(
  //         date.v as number,
  //         time.v as number
  //       );

  //       const matchRange = dateData > range[0] && dateData < range[1];

  //       if (matchRange) {
  //         chartData.push(dateData);
  //       }
  //     }
  //   }

  //   return this.groupForChart(chartData);
  // }
}

export const dataParser = new DataParser();
