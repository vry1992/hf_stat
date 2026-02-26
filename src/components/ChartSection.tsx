import { Form, Select, SelectProps, Tag } from 'antd';
import { useForm } from 'antd/es/form/Form';
import React, { FC, useState } from 'react';
import { ChartData, Detelization } from '../api/data-parser';
import { Chart } from './Chart';
const className = 'export-class';

export const ChartSection: FC<{
  networkId: string;
  who: Record<string, number>;
  whom: Record<string, number>;
  frequencies: Record<string, number>;
  chartData: ChartData;
  detalization: Detelization;
  maxY: number;
  name: string;
  onChange: (
    networkId: string,
    values: {
      frequencies: number[];
      who: string[];
      whom: string[];
    }
  ) => void;
}> = ({
  who,
  whom,
  frequencies,
  networkId,
  chartData,
  detalization,
  maxY,
  name,
  onChange,
}) => {
  const [form] = useForm<{
    frequencies: number[];
    who: string[];
    whom: string[];
  }>();

  const [removed, setRemoved] = useState<{
    frequencies: number[];
    who: string[];
    whom: string[];
  }>({
    frequencies: [],
    who: [],
    whom: [],
  });

  const csWho = Object.entries(who).map(([cs]) => ({
    label: cs,
    value: cs,
  }));

  const csWhom = Object.entries(whom).map(([cs]) => ({
    label: cs,
    value: cs,
  }));

  const fr = Object.entries(frequencies).map(([f]) => ({
    label: f,
    value: +f,
  }));

  const whoTagRender: SelectProps['tagRender'] = (tagProps) => {
    const { label, value, closable, onClose } = tagProps;

    const handleClose = (e: React.MouseEvent) => {
      e.preventDefault(); // важливо
      e.stopPropagation();

      setRemoved((prev) => {
        return {
          ...prev,
          who: [...prev.who, value],
        };
      });

      onClose?.(e); // обовʼязково викликати оригінальний
    };

    const count = who[String(value)] ?? 0;

    return (
      <Tag
        closable={closable}
        onClose={handleClose}
        style={{ marginInlineEnd: 4 }}>
        {label} ({count})
      </Tag>
    );
  };

  const whomTagRender: SelectProps['tagRender'] = (tagProps) => {
    const { label, value, closable, onClose } = tagProps;

    const handleClose = (e: React.MouseEvent) => {
      e.preventDefault(); // важливо
      e.stopPropagation();

      setRemoved((prev) => {
        return {
          ...prev,
          whom: [...prev.whom, value],
        };
      });

      onClose?.(e); // обовʼязково викликати оригінальний
    };

    const count = whom[String(value)] ?? 0;

    return (
      <Tag
        closable={closable}
        onClose={handleClose}
        style={{ marginInlineEnd: 4 }}>
        {label} ({count})
      </Tag>
    );
  };

  const freqTagRender: SelectProps['tagRender'] = (tagProps) => {
    const { label, value, closable, onClose } = tagProps;

    const handleClose = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setRemoved((prev) => {
        return {
          ...prev,
          frequencies: [...prev.frequencies, value],
        };
      });

      onClose?.(e);
    };

    const count = frequencies[String(value)] ?? 0;

    return (
      <Tag
        closable={closable}
        onClose={handleClose}
        style={{ marginInlineEnd: 4 }}>
        {label} ({count})
      </Tag>
    );
  };

  const Removed: FC<{
    list: (string | number)[];
    key: string;
    onClose: (tagName: string | number) => void;
  }> = ({ list, key, onClose }) => {
    return (
      <div
        style={{
          paddingLeft: 20,
          paddingBottom: 10,
        }}>
        {list.map((tag) => {
          return (
            <Tag
              color="red"
              key={`${key}_${tag}`}
              closable
              onClose={() => onClose(tag)}>
              {tag}
            </Tag>
          );
        })}
      </div>
    );
  };

  return (
    <div className={className} key={networkId}>
      <Form
        form={form}
        name="basic"
        autoComplete="off"
        initialValues={{
          who: csWho.map(({ value }) => value),
          whom: csWhom.map(({ value }) => value),
          frequencies: fr.map(({ value }) => value),
        }}
        onFinish={(v) => {
          onChange(networkId, v);
        }}>
        <Form.Item label="Позивні (Хто)" style={{ paddingLeft: 20 }} name="who">
          <Select
            mode="multiple"
            onChange={() => form.submit()}
            options={csWho}
            tagRender={whoTagRender}
          />
        </Form.Item>
        <Removed
          list={removed.who}
          key="who"
          onClose={(tagName: string | Number) => {
            const prev = form.getFieldValue('who');
            form.setFieldValue('who', [...prev, tagName]);
            form.submit();
            setRemoved((prev) => {
              return {
                ...prev,
                who: prev.who.filter((w) => w !== tagName),
              };
            });
          }}
        />

        <Form.Item
          label="Позивні (Кого)"
          style={{ paddingLeft: 20 }}
          name="whom">
          <Select
            mode="multiple"
            onChange={(a, b) => {
              console.log(a, b);
              form.submit();
            }}
            options={csWhom}
            tagRender={whomTagRender}
          />
        </Form.Item>
        <Removed
          list={removed.whom}
          key="whom"
          onClose={(tagName: string | Number) => {
            const prev = form.getFieldValue('whom');
            form.setFieldValue('whom', [...prev, tagName]);
            form.submit();
            setRemoved((prev) => {
              return {
                ...prev,
                whom: prev.whom.filter((w) => w !== tagName),
              };
            });
          }}
        />

        <Form.Item
          label="Частоти"
          style={{ paddingLeft: 20 }}
          name="frequencies">
          <Select
            mode="multiple"
            onChange={() => form.submit()}
            options={fr}
            tagRender={freqTagRender}
          />
        </Form.Item>
        <Removed
          list={removed.frequencies}
          key="frequencies"
          onClose={(tagName: string | Number) => {
            const prev = form.getFieldValue('frequencies');
            form.setFieldValue('frequencies', [...prev, tagName]);
            form.submit();
            setRemoved((prev) => {
              return {
                ...prev,
                frequencies: prev.frequencies.filter((fr) => fr !== tagName),
              };
            });
          }}
        />
      </Form>

      <Chart
        data={chartData}
        detalization={detalization}
        maxY={maxY}
        name={name}
      />
    </div>
  );
};
