let _timeout;

export const debounce = (cb: () => void, ms: number = 300) => {
  if (_timeout) {
    clearTimeout(_timeout);
  }

  _timeout = setTimeout(cb, ms);
};
