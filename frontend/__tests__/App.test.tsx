/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders correctly', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  try {
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<App />);
    });
    expect(tree!.toJSON()).not.toBeNull();
  } finally {
    await ReactTestRenderer.act(async () => { tree?.unmount(); });
  }
});
