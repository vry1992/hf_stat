import { addDays, addHours } from 'date-fns';
import dayjs, { Dayjs } from 'dayjs';
import { CellObject, SSF, WorkSheet } from 'xlsx';
import { FilePayload } from './types';

const config = {
  serviceSheets: ['Посилання'],
  networkNameCellName: 'A1',
  dateCollName: 'A',
  timeCollName: 'B',
  dataStartRow: 4,
  detalization: {
    day: {
      format: 'DD.MM.YYYY',
      fixerDiff: 1,
    },
    hour: {
      format: 'DD.MM.YYYY HH:mm',
      fixerDiff: 24,
    },
  },
};

export type ChartItemType = { key: string; count: number; name?: string };

export type ChartDataType = {
  [key: string]: ChartItemType;
};
class DataParser {
  private data: FilePayload | null = null;
  private diff: number = 0;
  private range: [Dayjs, Dayjs] | [] = [];
  private detalization: 'day' | 'hour' = 'day';

  init(content: FilePayload) {
    this.data = content;
  }

  get sheetNames() {
    return this.data?.SheetNames || [];
  }

  private convertExcelDateToJsDate(xDate: number, xTime: number) {
    const { y, m, d, H, M } = SSF.parse_date_code(xDate + xTime);

    return dayjs(new Date(y, m - 1, d, H, M));
  }

  analyzeSheet(
    sheetName: string,
    range: [Dayjs, Dayjs],
    detalization: 'day' | 'hour'
  ): ChartItemType[] {
    if (!this.data) return [];

    const sheetData = this.data.Sheets[sheetName];

    return this.getDateTimeData(sheetData, range, detalization);
  }

  getDateTimeData(
    sheetData: WorkSheet,
    range: [Dayjs, Dayjs],
    detalization: 'day' | 'hour'
  ): ChartItemType[] {
    const maxRow = Number(
      sheetData['!ref']?.split(':')[1].replace(new RegExp('[A-Z]*'), '')
    );
    const chartData: Dayjs[] = [];
    this.diff = range[1].diff(range[0], detalization);
    this.range = range;
    this.detalization = detalization;

    for (let i = config.dataStartRow; i <= maxRow; i++) {
      const dateCellKey = `${config.dateCollName}${i}`;
      const timeCellKey = `${config.timeCollName}${i}`;
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
        const matchRange = dateData >= range[0] && dateData <= range[1];

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
    const modifier = this.detalization === 'day' ? addDays : addHours;
    const res = {};
    for (let i = 0; i <= this.diff; i++) {
      const dateKeyStr = dayjs(
        modifier(this.range[0]?.set('minute', 0)?.toDate() || new Date(), i)
      )?.format(config.detalization[this.detalization as string].format);

      res[dateKeyStr] = { key: dateKeyStr, count: 0 };
    }

    return res;
  }
}

export const dataParser = new DataParser();
