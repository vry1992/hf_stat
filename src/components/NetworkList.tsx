import React, { ChangeEvent, FC } from 'react';
import { NetworkName } from '../api/data-parser';

export const NetworkList: FC<{
  onSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  data: NetworkName[];
}> = ({ onSelect, data }) => {
  const grouped = data.reduce<{
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

      {grouped.inactive.map(({ id, name, amountInterceptions }) => {
        return (
          <div key={id}>
            <p className="select_sheet_label">
              {name}{' '}
              <span
                style={{ color: amountInterceptions > 0 ? 'green' : 'red' }}>
                ({amountInterceptions} перехоплень)
              </span>
            </p>
          </div>
        );
      })}
    </div>
  );
};
