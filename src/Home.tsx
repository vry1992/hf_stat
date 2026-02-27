import { ConfigProvider, DatePicker, Select } from 'antd';
import ukUA from 'antd/locale/uk_UA';
import CryptoJS from 'crypto-js';
import { addDays } from 'date-fns';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/uk';
import * as echarts from 'echarts';
import React, {
  ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { FullScreenSpinner } from './Spinner';
import {
  ChartData,
  Detelization,
  NetworkName,
  dataParser,
} from './api/data-parser';
import { excelReader } from './api/excel-reader';
import { exportTablesToPdf } from './api/export-pdf';
import { ChartSection } from './components/ChartSection';
import { NetworkList } from './components/NetworkList';

function hashArrayBuffer(arrayBuffer: ArrayBuffer) {
  const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer as any);
  return CryptoJS.SHA256(wordArray).toString(CryptoJS.enc.Hex);
}

const { RangePicker } = DatePicker;
const className = 'export-class';

const currentDate = new Date();
const defaultFrom = dayjs(addDays(currentDate, -6))
  .hour(0)
  .minute(0)
  .second(0)
  .millisecond(0);
const defaultTo = dayjs(currentDate);

export const GROUP_ID = 'frequency-sync-group';

export const Home = () => {
  const testFr = useRef<
    Record<
      string,
      {
        frequencies: number[];
        who: string[];
        whom: string[];
        connect: string[];
      }
    >
  >({});
  const [networkNames, setNetworkNames] = useState<NetworkName[]>([]);
  const [range, setRange] = useState<[Dayjs, Dayjs]>([defaultFrom, defaultTo]);
  const [detalization, setDetalization] = useState<Detelization>('hour');
  const [maxY, setMaxY] = useState<number>(0);
  const [pending, setPending] = useState(false);
  const [fName, setFName] = useState<string[]>([]);

  const [charts, setCharts] = useState<
    {
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
    }[]
  >([]);

  useEffect(() => {
    if (charts.length > 0) {
      echarts.connect(GROUP_ID);
    }
  }, [charts]);

  const allowMinuteDetalization =
    detalization === 'hour'
      ? range[1].diff(range[0], 'hour') <= 24
      : detalization === 'day'
      ? range[1].diff(range[0], 'day') <= 1
      : false;

  const runExport = async () => {
    try {
      const name = `Експорт р/м ${range[0].format(
        'DD.MM.YYYY HH.mm'
      )} - ${range[1].format('DD.MM.YYYY HH.mm')}`;

      setPending(true);
      await exportTablesToPdf(className, name);
    } catch (error) {
      alert('Помилка експорту');
    } finally {
      setPending(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onloadstart = () => {
      setPending(true);
    };

    reader.onerror = () => {
      alert(`Помилка зчитування файлу ${file.name}`);
      setPending(false);
    };

    reader.onabort = () => {
      setPending(false);
    };

    reader.onload = (evt) => {
      try {
        if (evt?.target?.result) {
          const buffer = evt.target.result as ArrayBuffer;

          const hash = hashArrayBuffer(buffer);
          const fileName = file.name;

          const fileData = new Uint8Array(evt.target.result as ArrayBuffer);
          const data = excelReader.read(fileData);

          dataParser.init(data, {
            fileName,
            hash,
          });

          setFName((prev) => {
            return [...prev, fileName];
          });
        }
      } catch (error) {
        alert('Помилка читання файлу');
      } finally {
        setPending(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const getNetworkData = useCallback(async (networkId: string) => {
    const filters = testFr.current?.[networkId] || {
      frequencies: [],
      who: [],
      whom: [],
      connect: [],
    };

    const networkData = await dataParser.getNetworkData(networkId, filters);

    if (networkData) {
      setCharts((prev) => {
        const hasThis = prev.find(
          ({ networkId }) => networkData.networkId === networkId
        );

        if (hasThis) {
          return prev.map((item) => {
            if (item.networkId === networkData.networkId) {
              return networkData;
            }
            return item;
          });
        }
        return [...prev, { ...networkData }];
      });
      if (maxY < networkData.maxY) {
        setMaxY(networkData.maxY);
      }
    }
  }, []);

  const handleSheetSelection = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const checked = e.target.checked;
      const networkId = e.target.id;
      if (checked) {
        setPending(true);
        await getNetworkData(networkId);
        setPending(false);
      } else {
        setCharts((prev) => {
          return [...prev.filter((chart) => chart.networkId !== networkId)];
        });
      }
    },
    [getNetworkData]
  );

  const handleDateRange: Parameters<typeof RangePicker>[0]['onChange'] = (
    dates,
    _dateStrings
  ) => {
    if (dates && dates[0] && dates[1]) {
      dates[1] = dates[1].endOf('day');
      let det = detalization;
      let changeDetalization = false;
      if (detalization === 'minute') {
        changeDetalization = dates[1].diff(dates[0], 'minute') > 1440;
        if (changeDetalization) {
          det = 'hour';
          setDetalization(det);
        }
      }

      setRange(dates as [Dayjs, Dayjs]);
    }
  };

  const onChangeDetalization = (value: Detelization) => {
    setDetalization(value);
    dataParser.setDetalization = value;
  };

  const bulkUpdateCharts = async () => {
    const currentNetworkIds = charts.map(({ networkId }) => networkId);
    const newCharts: {
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
    }[] = [];

    let newMaxY = 0;
    dataParser.setDetalization = detalization;
    for await (const networkId of currentNetworkIds) {
      const filters = testFr.current?.[networkId] || {
        frequencies: [],
        who: [],
        whom: [],
        connect: [],
      };
      const networkData = await dataParser.getNetworkData(networkId, filters);
      if (!networkData) return;
      if (newMaxY < networkData.maxY) {
        newMaxY = networkData.maxY;
      }
      newCharts.push(networkData);
    }
    setCharts(newCharts);
    setMaxY(newMaxY);
  };

  useEffect(() => {
    dataParser.detalization = detalization;
    dataParser.onMainFilterChange({ range }, detalization);
    const netNames = dataParser.getNetworkNames();
    setNetworkNames(netNames);
    bulkUpdateCharts();
  }, [networkNames.length, fName.length, range, detalization]);

  return (
    <div>
      {pending && <FullScreenSpinner />}
      <div>
        <label htmlFor="file">Оберіть файл: </label>
        <input
          type="file"
          id="file"
          onChange={handleFile}
          accept=".xlsx, .xlsm"
        />
        <br />
        <div>
          <ConfigProvider locale={ukUA}>
            <label>Оберіть період часу для аналізу: </label>
            <RangePicker
              placeholder={['Дата початку', 'До тепер']}
              allowEmpty={[false, false]}
              value={range}
              onChange={handleDateRange}
              disabled={!networkNames.length}
              maxDate={dayjs()}
            />
          </ConfigProvider>
        </div>

        <div>
          <label>Оберіть рівень деталізації: </label>
          <Select<Detelization>
            showSearch
            style={{ width: 400 }}
            disabled={!networkNames.length}
            placeholder="Оберіть деталізацію"
            optionFilterProp="label"
            onChange={onChangeDetalization}
            value={detalization}
            options={[
              {
                value: 'day',
                label: 'До дня',
              },
              {
                value: 'hour',
                label: 'До години',
              },
              {
                value: 'minute',
                label: `${
                  !allowMinuteDetalization && detalization !== 'minute'
                    ? 'Зменшіть період до 1 дня для вибору "До хвилини"'
                    : 'До хвилини'
                }`,
                disabled: !allowMinuteDetalization,
              },
            ]}
          />
        </div>

        {charts.length ? (
          <button onClick={runExport}>Експортувати в PDF</button>
        ) : null}

        <NetworkList onSelect={handleSheetSelection} data={networkNames} />
      </div>

      {charts.map((props) => {
        return (
          <ChartSection
            key={props.networkId}
            networkId={props.networkId}
            who={props.callsigns.who}
            whom={props.callsigns.whom}
            connect={props.callsigns.connect}
            frequencies={props.frequencies}
            chartData={props.chartData}
            detalization={detalization}
            maxY={props.maxY}
            name={props.name}
            onChange={(
              networkId: string,
              values: {
                frequencies: number[];
                who: string[];
                whom: string[];
                connect: string[];
              }
            ) => {
              testFr.current[networkId] = values;
              getNetworkData(networkId);
            }}
          />
        );
      })}
    </div>
  );
};
