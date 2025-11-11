import { ConfigProvider, DatePicker, Select } from 'antd';
import ukUA from 'antd/locale/uk_UA';
import colorspace from 'colorspace';
import { addDays } from 'date-fns';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/uk';
import React, { ChangeEvent, FC, useCallback, useState } from 'react';
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartItemType,
  SheetAnalysisResultType,
  dataParser,
} from './api/data-parser';
import { excelReader } from './api/excel-reader';

// *******************

const daysShortUA = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const dayColors: Record<string, string> = {
  пн: '#cce5ff',
  вт: '#d4edda',
  ср: '#fff3cd',
  чт: '#d1ecf1',
  пт: '#e2ccff',
  сб: '#ccd9ff',
  нд: '#f8d7da',
};

type CustomTickProps = {
  x?: number;
  y?: number;
  payload?: { value: string };
  detalization: 'day' | 'hour';
};

export const CustomTick: React.FC<
  CustomTickProps & {
    hoveredDay?: string | null;
    setHoveredDay?: (day: string | null) => void;
  }
> = ({ x = 0, y = 0, payload, detalization, hoveredDay, setHoveredDay }) => {
  const key = payload?.value ?? '';
  const [datePart, time] = key.split(' ');
  const [day, month, year] = datePart.split('.');
  const date = dayjs(`${year}-${month}-${day}`);
  const dayName = daysShortUA[date.day()];
  const color = dayColors[dayName] || '#eee';

  const isHovered = hoveredDay === dayName;

  const dateText =
    detalization === 'hour'
      ? `${day}.${month} ${time ?? ''}`
      : `${day}.${month}`;
  const dayText = ` (${dayName})`;

  return (
    <g
      transform={`translate(${x},${y})`}
      onMouseEnter={() => setHoveredDay?.(dayName)}
      onMouseLeave={() => setHoveredDay?.(null)}
      style={{ cursor: 'pointer' }}>
      <rect
        x={-10}
        y={-2}
        width={20}
        height={detalization === 'day' ? 63 : 100}
        fill={isHovered ? '#ffd580' : color}
        rx={3}
        opacity={isHovered ? 1 : 0.5}
      />

      <text
        transform="rotate(-90)"
        x={-27}
        y={5}
        textAnchor="end"
        fontSize={11}
        fill={isHovered ? '#000' : '#333'}
        fontWeight={isHovered ? 'bold' : 'normal'}>
        {dateText}
      </text>

      <text
        transform="rotate(-90)"
        x={-3}
        y={5}
        textAnchor="end"
        fontSize={10}
        fill={isHovered ? '#000' : '#444'}
        fontWeight={isHovered ? 'bold' : 'normal'}>
        {dayText}
      </text>
    </g>
  );
};

// *******************

const { RangePicker } = DatePicker;

const currentDate = new Date();
const defaultFrom = dayjs(addDays(currentDate, -3));
const defaultTo = dayjs(currentDate);

const blackListCheckboxes = ['пошук', 'посилання'].map((n) => n.toLowerCase());

const CustomTooltip: FC<{
  active: boolean;
  payload: { name: string; value: number; color: string }[];
  label: string;
}> = ({ active, payload, label }) => {
  const isVisible = active && payload && payload.length;

  if (!isVisible) return;

  return (
    <div
      style={{
        background: '#ffffff99',
        padding: 10,
        border: '1px solid #00000050',
      }}>
      <h4>{label}</h4>
      {payload
        .sort((a, b) => {
          return b.value - a.value;
        })
        .map(({ name, value, color }) => {
          return (
            <div
              style={{
                display: 'flex',
                justifyContent: 'left',
                alignItems: 'center',
                paddingRight: 10,
              }}>
              <div
                style={{
                  background: color,
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  paddingRight: 10,
                  marginRight: 10,
                }}></div>
              <p key={name}>
                <span>{name}:</span>{' '}
                <span style={{ fontWeight: 'bold' }}>{value}</span>
              </p>
            </div>
          );
        })}
    </div>
  );
};

export const Home = () => {
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const [data, setData] = useState<{ [name: string]: SheetAnalysisResultType }>(
    {}
  );

  const counts = Object.values(data)
    .reduce<ChartItemType[]>((acc, curr) => {
      return [...acc, ...curr.data];
    }, [])
    .map(({ count }) => count);

  const globalMax = Math.max(...counts);

  const [overlapMode, setOverlapMode] = useState(false);

  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [range, setRange] = useState<[Dayjs, Dayjs]>([defaultFrom, defaultTo]);
  const [detalization, setDetalization] = useState<'day' | 'hour'>('day');

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
      const sheetName = e.target.name;
      if (data[sheetName]) {
        const newData = { ...data };
        delete newData[sheetName];

        setData(newData);
      } else {
        const chartData: SheetAnalysisResultType = dataParser.analyzeSheet(
          sheetName,
          range,
          detalization
        );
        setData((prev) => {
          return {
            ...prev,
            [sheetName]: chartData,
          };
        });
      }
    },
    [data, range, detalization]
  );

  const handleDateRange: Parameters<typeof RangePicker>[0]['onChange'] = (
    dates,
    _dateStrings
  ) => {
    if (dates && dates[0] && dates[1]) {
      setRange(dates as [Dayjs, Dayjs]);

      const selectedSheets = Object.keys(data);

      const nextDataState = {};

      selectedSheets.forEach((sheetName) => {
        const chartData: SheetAnalysisResultType = dataParser.analyzeSheet(
          sheetName,
          dates as [Dayjs, Dayjs],
          detalization
        );
        nextDataState[sheetName] = chartData;
      });

      setData({ ...nextDataState });
    }
  };

  const onChangeDetalization = (value: 'day' | 'hour') => {
    setDetalization(value);

    const nextDataState = {};

    const selectedSheets = Object.keys(data);

    selectedSheets.forEach((sheetName) => {
      const chartData: SheetAnalysisResultType = dataParser.analyzeSheet(
        sheetName,
        range,
        value
      );
      nextDataState[sheetName] = chartData;
    });

    setData({ ...nextDataState });
  };

  const combinedData = React.useMemo(() => {
    if (!overlapMode || Object.keys(data).length === 0) return [];

    const allKeys = Array.from(
      new Set(
        Object.values(data).flatMap((sheet) => sheet.data.map((d) => d.key))
      )
    );

    return allKeys.map((key) => {
      const row: Record<string, any> = { key };
      for (const sheetData of Object.values(data)) {
        const found = sheetData.data.find((d) => d.key === key);
        row[sheetData.fullName] = found ? found.count : 0;
      }
      return row;
    });
  }, [data, overlapMode]);

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
          <label htmlFor={'overlapMode'}>
            Режим накладання увімкнено
            <input
              type="checkbox"
              onChange={() => setOverlapMode(!overlapMode)}
              checked={overlapMode}
              name={'overlapMode'}
            />
          </label>
        </div>

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

        <div className="all_checkboxes_container">
          {sheetNames
            .filter(
              (sheetName) =>
                !blackListCheckboxes.includes(sheetName.toLowerCase())
            )
            .map((sheetName, idx) => (
              <div
                key={`${idx}_${sheetName}`}
                className="select_sheet_checkbox__container">
                <label htmlFor={sheetName} className="select_sheet_label">
                  {sheetName}
                  <input
                    className="select_sheet_checkbox"
                    id={sheetName}
                    type="checkbox"
                    onChange={handleSheetSelection}
                    checked={!!data[sheetName]}
                    name={sheetName}
                  />
                </label>
              </div>
            ))}
        </div>
      </div>

      {data &&
        !overlapMode &&
        Object.values(data).map((dataItem, i) => {
          return (
            <div
              key={i}
              style={{ width: '100vw', height: '400px', marginBottom: '40px' }}>
              <p style={{ textAlign: 'center', fontWeight: 'bold' }}>
                {dataItem.fullName}
              </p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dataItem.data}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  barSize={20}>
                  <XAxis
                    dataKey="key"
                    scale="point"
                    padding={{ left: 10, right: 10 }}
                    angle={-90}
                    textAnchor="end"
                    height={170}
                    tickMargin={1}
                    allowDecimals={false}
                    tick={(props) => (
                      <CustomTick
                        {...props}
                        detalization={detalization}
                        hoveredDay={hoveredDay}
                        setHoveredDay={setHoveredDay}
                      />
                    )}
                    interval="preserveStartEnd"
                  />
                  <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                  <YAxis domain={[0, globalMax]} allowDecimals={false} />
                  <Tooltip />
                  <CartesianGrid strokeDasharray="3 3" />
                  <Bar
                    dataKey="count"
                    fill="#8884d8"
                    background={{ fill: '#eee' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        })}

      {data && overlapMode && (
        <div style={{ width: '100vw', height: '400px', marginBottom: '40px' }}>
          <p style={{ textAlign: 'center', fontWeight: 'bold' }}>Порівняння</p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={combinedData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              barSize={20}>
              <XAxis
                dataKey="key"
                scale="point"
                padding={{ left: 10, right: 10 }}
                angle={-90}
                textAnchor="end"
                height={150}
                tickMargin={1}
                tick={(props) => (
                  <CustomTick
                    {...props}
                    detalization={detalization}
                    hoveredDay={hoveredDay}
                    setHoveredDay={setHoveredDay}
                  />
                )}
              />
              <YAxis allowDecimals={false} />
              {/* @ts-ignore */}
              <Tooltip content={(props) => <CustomTooltip {...props} />} />
              <CartesianGrid strokeDasharray="3 3" />
              <Brush dataKey="key" height={30} stroke="#8884d8" />
              {Object.values(data).map(({ fullName }) => (
                <Bar
                  key={fullName}
                  dataKey={fullName}
                  fill={colorspace(fullName)}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
