import React, { ChangeEvent, FC } from 'react';
import { NetworkName } from '../api/data-parser';

export const NetworkList: FC<{
  onUncheckAll: () => void;
  onSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  data: NetworkName[];
}> = ({ onUncheckAll, onSelect, data }) => {
  return (
    <div className="all_checkboxes_container">
      <div className="select_sheet_checkbox__container">
        <button onClick={onUncheckAll}>Зняти всі</button>
      </div>
      {data.map(({ id, name, amountInterceptions }) => (
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
    </div>
  );
};
