import { Collapse, Form, Select, SelectProps, Tag } from 'antd';
import { useForm } from 'antd/es/form/Form';
import React, { FC, useState } from 'react';
import { ChartData, Detelization } from '../api/data-parser';
import { Chart } from './Chart';
const className = 'export-class';

type FormType = {
  frequencies: number[];
  who: string[];
  whom: string[];
  connect: string[];
};

export const ChartSection: FC<{
  networkId: string;
  who: Record<string, number>;
  whom: Record<string, number>;
  connect: Record<string, number>;
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
      connect: string[];
    }
  ) => void;
}> = ({
  who,
  whom,
  connect,
  frequencies,
  networkId,
  chartData,
  detalization,
  maxY,
  name,
  onChange,
}) => {
  const [form] = useForm<FormType>();

  const [removed, setRemoved] = useState<FormType>({
    frequencies: [],
    who: [],
    whom: [],
    connect: [],
  });

  const csWho = Object.entries(who).map(([cs]) => ({
    label: cs,
    value: cs,
  }));

  const csWhom = Object.entries(whom).map(([cs]) => ({
    label: cs,
    value: cs,
  }));

  const csConnect = Object.entries(connect).map(([cs]) => ({
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
      e.preventDefault();
      e.stopPropagation();

      setRemoved((prev) => {
        return {
          ...prev,
          who: [...prev.who, value],
        };
      });

      onClose?.(e);
    };

    const count = who[String(value)] ?? 0;

    return (
      <Tag closable={closable} onClose={handleClose} style={{ margin: 2 }}>
        {count > 0 ? (
          <b>
            {label} ({count})
          </b>
        ) : (
          <span>
            {label} ({count})
          </span>
        )}
      </Tag>
    );
  };

  const connectTagRender: SelectProps['tagRender'] = (tagProps) => {
    const { label, value, closable, onClose } = tagProps;

    const handleClose = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setRemoved((prev) => {
        return {
          ...prev,
          connect: [...prev.connect, value],
        };
      });

      onClose?.(e);
    };

    const count = connect[String(value)] ?? 0;

    return (
      <Tag
        closable={closable}
        onClose={handleClose}
        style={{ marginInlineEnd: 4 }}>
        {count > 0 ? (
          <b>
            {label} ({count})
          </b>
        ) : (
          <span>
            {label} ({count})
          </span>
        )}
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

      onClose?.(e);
    };

    const count = whom[String(value)] ?? 0;

    return (
      <Tag
        closable={closable}
        onClose={handleClose}
        style={{ marginInlineEnd: 4 }}>
        {count > 0 ? (
          <b>
            {label} ({count})
          </b>
        ) : (
          <span>
            {label} ({count})
          </span>
        )}
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
        {count > 0 ? (
          <b>
            {label} ({count})
          </b>
        ) : (
          <span>
            {label} ({count})
          </span>
        )}
      </Tag>
    );
  };

  const Removed: FC<{
    list: (string | number)[];
    removedLabel: string;
    onClose: (tagName: string | number) => void;
  }> = ({ list, removedLabel, onClose }) => {
    return (
      <div
        key={Math.random()}
        style={{
          paddingTop: 4,
          paddingBottom: 4,
          minHeight: 20,
        }}>
        {list.length ? `Видалені ${removedLabel}: ` : ''}
        {list.map((tag) => {
          return (
            <Tag
              color="red"
              style={{
                marginBottom: 4,
              }}
              key={Math.random()}
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
        name={networkId}
        autoComplete="off"
        initialValues={{
          who: csWho.map(({ value }) => value),
          whom: csWhom.map(({ value }) => value),
          connect: csConnect.map(({ value }) => value),
          frequencies: fr.map(({ value }) => value),
        }}
        onFinish={(v) => {
          onChange(networkId, v);
        }}>
        <Collapse
          style={{ margin: 0 }}
          items={[
            {
              key: '1',
              label: 'Позивні (Кого)',
              children: (
                <Form.Item
                  style={{ paddingLeft: 0, marginBottom: 0 }}
                  name="whom">
                  <Select
                    open={false}
                    mode="multiple"
                    allowClear
                    onClear={() => {
                      form.submit();
                      setRemoved((prev) => ({
                        ...prev,
                        whom: [
                          ...new Set([
                            ...prev.whom,
                            ...form.getFieldValue('whom'),
                          ]),
                        ],
                      }));
                    }}
                    onChange={() => {
                      form.submit();
                    }}
                    options={csWhom}
                    tagRender={whomTagRender}
                  />
                </Form.Item>
              ),
            },
          ]}
        />

        <Removed
          list={removed.whom}
          removedLabel="позивні 'кого'"
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

        <Collapse
          style={{ margin: 0, padding: 0 }}
          items={[
            {
              key: '2',
              label: 'Позивні (Хто)',
              children: (
                <Form.Item
                  style={{ paddingLeft: 0, marginBottom: 0 }}
                  name="who">
                  <Select
                    mode="multiple"
                    allowClear
                    onClear={() => {
                      form.submit();
                      setRemoved((prev) => ({
                        ...prev,
                        who: [
                          ...new Set([
                            ...prev.who,
                            ...form.getFieldValue('who'),
                          ]),
                        ],
                      }));
                    }}
                    open={false}
                    onChange={() => form.submit()}
                    options={csWho}
                    tagRender={whoTagRender}
                  />
                </Form.Item>
              ),
            },
          ]}
        />

        <Removed
          list={removed.who}
          removedLabel="позивні 'хто'"
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

        <Collapse
          style={{ margin: 0 }}
          items={[
            {
              key: '3',
              label: 'Позивні в парі',
              children: (
                <Form.Item
                  style={{ paddingLeft: 0, marginBottom: 0 }}
                  name="connect">
                  <Select
                    mode="multiple"
                    allowClear
                    onClear={() => {
                      form.submit();
                      setRemoved((prev) => ({
                        ...prev,
                        connect: [
                          ...new Set([
                            ...prev.connect,
                            ...form.getFieldValue('connect'),
                          ]),
                        ],
                      }));
                    }}
                    open={false}
                    onChange={() => form.submit()}
                    options={csConnect}
                    tagRender={connectTagRender}
                  />
                </Form.Item>
              ),
            },
          ]}
        />

        <Removed
          list={removed.connect}
          removedLabel="позивні Хто => Кого"
          onClose={(tagName: string | Number) => {
            const prev = form.getFieldValue('connect');
            form.setFieldValue('connect', [...prev, tagName]);
            form.submit();
            setRemoved((prev) => {
              return {
                ...prev,
                connect: prev.connect.filter((w) => w !== tagName),
              };
            });
          }}
        />

        <Collapse
          style={{ margin: 0 }}
          items={[
            {
              key: '4',
              label: 'Частоти',
              children: (
                <Form.Item
                  label="Частоти"
                  style={{ paddingLeft: 0, marginBottom: 0 }}
                  name="frequencies">
                  <Select
                    mode="multiple"
                    open={false}
                    onChange={() => form.submit()}
                    options={fr}
                    tagRender={freqTagRender}
                    allowClear
                    onClear={() => {
                      form.submit();
                      setRemoved((prev) => ({
                        ...prev,
                        frequencies: [
                          ...new Set([
                            ...prev.frequencies,
                            ...form.getFieldValue('whom'),
                          ]),
                        ],
                      }));
                    }}
                  />
                </Form.Item>
              ),
            },
          ]}
        />

        <Removed
          list={removed.frequencies}
          removedLabel="частоти"
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
