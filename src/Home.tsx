import { ConfigProvider, DatePicker, Select } from 'antd';
import ukUA from 'antd/locale/uk_UA';
import { addDays } from 'date-fns';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/uk';
import React, { ChangeEvent, useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartItemType, dataParser } from './api/data-parser';
import { excelReader } from './api/excel-reader';

const { RangePicker } = DatePicker;

const currentDate = new Date();
const defaultFrom = dayjs(addDays(currentDate, -3));
const defaultTo = dayjs(currentDate);

export const Home = () => {
  const [data, setData] = useState<ChartItemType[][]>([]);

  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [range, setRange] = useState<[Dayjs, Dayjs]>([defaultFrom, defaultTo]);
  const [detalization, setDetalization] = useState<'day' | 'hour'>('day');
  const [lastOperation, setLastOperation] = useState<{
    name: string;
    checked: boolean;
  } | null>(null);
  const [drawed, setDrawed] = useState<{
    [name: string]: { value: any };
  } | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt?.target?.result) {
        const fileData = new Uint8Array(evt.target.result as ArrayBuffer);
        const data = excelReader.read(fileData);
        dataParser.init(data);
        setSheetNames(dataParser.sheetNames);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSheetSelection = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const { name, checked } = e.target;
      setSelectedSheets((prev) =>
        checked ? [...prev, name] : prev.filter((item) => item !== name)
      );
      setLastOperation({ name, checked });
    },
    []
  );

  useEffect(() => {
    if (lastOperation?.checked) {
      const chartData: ChartItemType[] = dataParser.analyzeSheet(
        lastOperation.name,
        range,
        detalization
      );

      chartData[0].name = lastOperation.name;

      setData((prev) => {
        return [...prev, chartData];
      });
    } else {
      setData((prev) => {
        return prev.filter((item) => {
          return item[0].name !== lastOperation?.name;
        });
      });
    }
  }, [selectedSheets, lastOperation, range, detalization]);

  const handleDateRange: Parameters<typeof RangePicker>[0]['onChange'] = (
    dates,
    _dateStrings
  ) => {
    if (dates && dates[0] && dates[1]) {
      setRange(dates as [Dayjs, Dayjs]);
      setData([]);
    }
  };

  const onChangeDetalization = (value: 'day' | 'hour') => {
    setDetalization(value);
    setData([]);
  };

  return (
    <div>
      <div>
        <label htmlFor="file">Оберіть файл: </label>
        <input
          type="file"
          id="file"
          onChange={handleFile}
          accept=".xlsx, .xlsm"
        />
        <br />
        <br />
        <div>
          <ConfigProvider locale={ukUA}>
            <label>Оберіть період часу для аналізу: </label>
            <RangePicker
              placeholder={['Дата початку', 'До тепер']}
              allowEmpty={[false, false]}
              value={range}
              onChange={handleDateRange}
            />
          </ConfigProvider>
        </div>
        <br />

        <div>
          <label>Оберіть рівень деталізації: </label>
          <Select
            showSearch
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
            ]}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {sheetNames.map((sheetName, idx) => (
            <div key={`${idx}_${sheetName}`} style={{ marginLeft: '10px' }}>
              <label htmlFor={sheetName}>
                {sheetName}
                <input
                  type="checkbox"
                  onChange={handleSheetSelection}
                  checked={selectedSheets.includes(sheetName)}
                  name={sheetName}
                />
              </label>
            </div>
          ))}
        </div>
      </div>

      {data &&
        data.map((dataItem) => {
          return (
            <div
              style={{ width: '100vw', height: '400px', marginBottom: '40px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dataItem}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  barSize={20}>
                  <XAxis
                    dataKey="key"
                    scale="point"
                    padding={{ left: 10, right: 10 }}
                    angle={-90} // кут обертання (спробуй -45, -60, -90)
                    textAnchor="end" // вирівнювання підпису
                    height={150} // відвести більше місця під підписи
                    tick={{ dy: 10 }} // додатковий зсув підписів вниз (поїграй з dy)
                    tickMargin={1} // додатковий відступ між віссю і підписами
                  />
                  <YAxis />
                  <Tooltip />
                  <CartesianGrid strokeDasharray="3 3" />
                  <Bar
                    dataKey="count"
                    fill="#8884d8"
                    background={{ fill: '#eee' }}
                  />
                </BarChart>
              </ResponsiveContainer>
              <p style={{ textAlign: 'center' }}>{dataItem[0].name}</p>
            </div>
          );
        })}
    </div>
  );
};
