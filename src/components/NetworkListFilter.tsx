import { Form, Input } from 'antd';
import React, { ChangeEvent } from 'react';
import { debounce } from '../utils';

type FieldType = {
  filter?: string;
};

export const NetworkListFilter: React.FC<{
  onFilter: (str: string) => void;
}> = ({ onFilter }) => (
  <Form.Item<FieldType> label="Назва мережі, частота, позивний" name="filter">
    <Input
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        debounce(() => onFilter(e.target.value));
      }}
    />
  </Form.Item>
);
