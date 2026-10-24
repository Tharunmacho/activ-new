import React from 'react';
import Renderer from 'react-test-renderer';
import { Linking, Text } from 'react-native';
import { ExploreContact } from '../src/components/explore/ExploreContact';
import { getPublicContactInfo } from '../src/services/publicContent';
import { publicOffices } from '../src/utils/contactOffices';

jest.mock('../src/services/publicContent', () => ({ getPublicContactInfo: jest.fn() }));
const office = (id: string, state: string, head = false) => ({ id, label: head ? 'Head Office' : state + ' Office', state, isHeadOffice: head,
  addressLines: ['ACTIV', state], mapEmbedUrl: 'https://www.google.com/maps?q=' + state + '&output=embed', directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=' + state });

test('office cards follow published offices and never use an untrusted map source', () => {
  expect(publicOffices({ offices: [{ ...office('a', 'Kerala'), isActive: false }, office('b', 'Karnataka'), office('head', 'Chennai', true)] }).map(o => o.id)).toEqual(['head', 'b']);
  expect(publicOffices({ sections: [{ key: 'contact.info', hidden: true }], offices: [office('a', 'Kerala')] })).toEqual([]);
  const legacy = publicOffices({ addressLines: ['ACTIV office'], mapEmbedUrl: 'javascript:alert(1)', mapLink: 'https://evil.example/path' })[0];
  expect(legacy.mapEmbedUrl).toBe('https://www.google.com/maps?q=ACTIV%20office&output=embed');
  expect(legacy.directionsUrl).toContain('https://www.google.com/maps/dir/');
});

test('changing offices updates the anonymous map, directions and the same website contact flow', async () => {
  const info = { offices: [office('head', 'Chennai', true), office('state', 'Karnataka')] };
  (getPublicContactInfo as jest.Mock).mockResolvedValue(info);
  const openPage = jest.fn(), link = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  let screen!: Renderer.ReactTestRenderer;
  const button = (label: string) => screen.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  const map = () => screen.root.findAll(node => node.props.source?.html)[0];
  try {
    await Renderer.act(async () => { screen = Renderer.create(<ExploreContact openPage={openPage} />); });
    expect(map().props.source.html).toContain('<iframe');
    expect(map().props.source.html).toContain('q=Chennai');
    expect(map().props.incognito).toBe(true);
    expect(map().props.source.headers).toBeUndefined();
    expect(map().props.sharedCookiesEnabled).toBe(false);
    const chooser = button('Choose an office: Head Office · Chennai');
    expect(chooser.props.accessibilityState.expanded).toBe(false);
    await Renderer.act(async () => chooser.props.onPress());
    const stateChoice = screen.root.findAll(node => node.props.accessibilityRole === 'radio' && typeof node.props.onPress === 'function'
      && node.findAllByType(Text).some(text => text.props.children === 'Karnataka Office'))[0];
    await Renderer.act(async () => stateChoice.props.onPress());
    expect(button('Choose an office: Karnataka Office').props.accessibilityState.expanded).toBe(false);
    expect(map().props.source.html).toContain('q=Karnataka');
    await Renderer.act(async () => button('Open directions to Karnataka Office').props.onPress());
    expect(link).toHaveBeenCalledWith(info.offices[1].directionsUrl);
    await Renderer.act(async () => button('Get in touch with ACTIV').props.onPress());
    expect(openPage).toHaveBeenCalledWith('/contact?state=Karnataka', 'Contact us');
    await Renderer.act(async () => map().props.onError());
    expect(map()).toBeUndefined();
    expect(button('Open directions to Karnataka Office')).toBeDefined();
    const previous = (getPublicContactInfo as jest.Mock).mock.calls.length;
    await Renderer.act(async () => screen.update(<ExploreContact openPage={openPage} refreshKey={1} />));
    expect(getPublicContactInfo).toHaveBeenCalledTimes(previous + 1);
  } finally { await Renderer.act(async () => screen?.unmount()); link.mockRestore(); }
});
