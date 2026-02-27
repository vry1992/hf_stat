import { Collapse } from 'antd';
import React, { ChangeEvent, FC, useState } from 'react';
import { NetworkName } from '../api/data-parser';
import { NetworkListFilter } from './NetworkListFilter';

export const NetworkList: FC<{
  onSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  data: NetworkName[];
}> = ({ onSelect, data }) => {
  const [f, setF] = useState<string>('');

  const onFilter = (str: string) => {
    setF(str);
  };

  const grouped = data
    .filter(({ name, frequencyData }) => {
      const hasName = name.toLowerCase().includes(f);

      const hasOther = frequencyData.some(({ frequency, who, whom }) => {
        const hasFr = frequency.toString().includes(f);
        const hasWho = who.toLowerCase().includes(f.toLowerCase());
        const hasWhom = whom.toLowerCase().includes(f.toLowerCase());

        return hasFr || hasWho || hasWhom;
      });

      return hasName || hasOther;
    })
    .reduce<{
      active: NetworkName[];
      inactive: NetworkName[];
    }>(
      (acc: { active: NetworkName[]; inactive: NetworkName[] }, curr) => {
        if (curr.amountInterceptions) {
          acc.active.push(curr);
        } else {
          acc.inactive.push(curr);
        }

        return acc;
      },
      { active: [], inactive: [] }
    );

  return (
    <div className="all_checkboxes_container">
      {data.length ? <NetworkListFilter onFilter={onFilter} /> : null}

      {grouped.active.map(({ id, name, amountInterceptions }) => (
        <div key={id} className="select_sheet_checkbox__container">
          <label htmlFor={id} className="select_sheet_label">
            <input
              className="select_sheet_checkbox"
              id={id}
              type="checkbox"
              onChange={onSelect}
              name={id}
              disabled={amountInterceptions === 0}
            />
            <div>
              <p>{name}</p>
              <p style={{ color: amountInterceptions > 0 ? 'green' : 'red' }}>
                ({amountInterceptions} перехоплень)
              </p>
            </div>
          </label>
        </div>
      ))}

      {grouped.inactive.length ? (
        <Collapse
          items={[
            {
              key: '1',
              label: 'Мережі без перехоплень',
              children: (
                <>
                  {grouped.inactive.map(({ id, name, amountInterceptions }) => {
                    return (
                      <div key={id}>
                        <p className="select_sheet_label">
                          {name}{' '}
                          <span
                            style={{
                              color: amountInterceptions > 0 ? 'green' : 'red',
                            }}>
                            ({amountInterceptions} перехоплень)
                          </span>
                        </p>
                      </div>
                    );
                  })}
                </>
              ),
            },
          ]}
        />
      ) : null}
    </div>
  );
};
