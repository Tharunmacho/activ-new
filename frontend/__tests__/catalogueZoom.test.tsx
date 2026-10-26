import React from 'react';
import Renderer from 'react-test-renderer';
import { Modal, Text } from 'react-native';
import { CatalogueAlbum } from '../src/components/CatalogueAlbum';
import { PhotoViewer } from '../src/ui/PhotoViewer';
import { API_ORIGIN } from '../src/config/api.config';

let screen: Renderer.ReactTestRenderer | undefined;
const button = (label: string) => screen!.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
beforeEach(() => { jest.useFakeTimers(); });
afterEach(async () => {
  await Renderer.act(async () => screen?.unmount());
  screen = undefined;
  jest.useRealTimers();
});

test('a tapped catalogue photo opens full resolution zoom, closes back to the same item, and respects Android back', async () => {
  const onClose = jest.fn();
  const onProductShown = jest.fn();
  const items = [
    { _id: 'one', name: 'First product', images: ['/uploads/first.jpg'] },
    { _id: 'two', name: 'Second product', images: ['/uploads/second.jpg', '/uploads/second-detail.jpg'] },
  ];
  await Renderer.act(async () => { screen = Renderer.create(<CatalogueAlbum items={items} startIndex={1} onClose={onClose} onProductShown={onProductShown} tone="business" />); });
  await Renderer.act(async () => { button('Enlarge Second product, photo 1').props.onPress(); });
  const viewer = screen!.root.findByType(PhotoViewer);
  expect(viewer.props.url).toBe(`${API_ORIGIN}/uploads/second.jpg`);
  expect(viewer.props.title).toContain('Second product');
  expect(screen!.root.findAll(node => typeof node.props.source?.html === 'string')[0].props.source.html).toContain('maximum-scale=5');
  await Renderer.act(async () => { screen!.root.findByType(Modal).props.onRequestClose(); });
  expect(screen!.root.findAllByType(PhotoViewer)).toHaveLength(0);
  expect(onClose).not.toHaveBeenCalled();
  expect(onProductShown).toHaveBeenCalledTimes(1);
  await Renderer.act(async () => { button('Close catalogue').props.onPress(); });
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('an item with no photo has no zoom action', async () => {
  await Renderer.act(async () => { screen = Renderer.create(<CatalogueAlbum items={[{ _id: 'empty', name: 'No photo' }]} startIndex={0} onClose={jest.fn()} />); });
  expect(screen!.root.findAllByType(PhotoViewer)).toHaveLength(0);
  const stage = screen!.root.findAll(node => node.props.accessibilityLabel === 'Enlarge No photo, photo 1')[0];
  expect(stage.props.disabled).toBe(true);
});

test('company cover photos open zoom without showing sale price or seller placeholders', async () => {
  await Renderer.act(async () => { screen = Renderer.create(<CatalogueAlbum items={[{
    _id: 'cover', name: 'Company cover', kind: 'Company photo', showPrice: false, images: ['/uploads/cover.jpg'],
  }]} startIndex={0} onClose={jest.fn()} />); });
  const labels = screen!.root.findAllByType(Text).map(node => String(node.props.children)).join(' ');
  expect(labels).not.toContain('Price on request');
  expect(labels).not.toContain('seller has not added');
  await Renderer.act(async () => { button('Enlarge Company cover, photo 1').props.onPress(); });
  expect(screen!.root.findByType(PhotoViewer).props.url).toBe(`${API_ORIGIN}/uploads/cover.jpg`);
});
