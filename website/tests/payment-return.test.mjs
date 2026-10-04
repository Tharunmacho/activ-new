import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';

// Execute the real return component's effects with controlled gateway replies.
const sources = {
  react: `const f=globalThis.fixture; export const useState=initial=>{const i=f.states.length;f.states.push(initial);return [initial,v=>{f.states[i]=v}]};export const useRef=v=>({current:v});export const useEffect=effect=>{f.effects.push(effect)};`,
  'react/jsx-runtime': `export const jsx=()=>null;export const jsxs=jsx;export const Fragment='fragment';`,
  'react-router-dom': `export const useNavigate=()=>globalThis.fixture.navigate;export const useSearchParams=()=>[globalThis.fixture.params];`,
  '@/services/paymentApi': `export const resolvePaymentReturn=(...args)=>globalThis.fixture.resolve(...args);export const getPaymentOrder=(...args)=>globalThis.fixture.owned(...args);`,
  '@/lib/session': `export const isMemberSession=()=>globalThis.fixture.member;`,
  '@/components/ui/card': `export const Card=()=>null;export const CardContent=Card;`,
  '@/components/ui/button': `export const Button=()=>null;`,
  'lucide-react': `export const Loader2=()=>null;export const CheckCircle2=Loader2;export const AlertCircle=Loader2;export const Clock=Loader2;`,
  '../member/MemberPageShell': `export default ()=>null;`,
};
const bundle = await build({ entryPoints: ['src/pages/payment/PaymentReturn.tsx'], bundle: true,
  write: false, format: 'cjs', platform: 'node', jsx: 'automatic', plugins: [{ name: 'return-fixture', setup(b) {
    b.onResolve({ filter: /.*/ }, args => args.path in sources ? { path: args.path, namespace: 'fixture' } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: sources[args.path], loader: 'js' }));
  } }] });

async function run({ replies, member = true, fallback } = {}) {
  const timers = [], calls = [], events = [], navigations = [], states = [], effects = [];
  let protectedReads = 0;
  const fixture = { states, effects, member, params: new URLSearchParams('orderId=ord_test&payment_id=MOJO-test'),
    navigate: (...args) => navigations.push(args),
    resolve: async (...args) => { calls.push(args); const reply = replies.shift(); if (reply instanceof Error) throw reply;
      return reply || { orderType: 'membership', status: 'created', amount: 10 }; },
    owned: async () => { protectedReads++; if (!fallback) throw Error('Protected read should not be needed'); return fallback; },
  };
  const context = vm.createContext({ fixture, module: { exports: {} },
    window: { dispatchEvent: event => events.push(event.type) }, Event,
    sessionStorage: { removeItem() {} }, Date,
    setTimeout: cb => { timers.push(cb); return timers.length; }, clearTimeout() {},
  });
  vm.runInContext(bundle.outputFiles[0].text, context);
  context.module.exports.default(); effects.forEach(effect => effect());
  const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  await flush();
  // A pending response must schedule another public verification, not stop there.
  for (let i = 0; timers.length && i < 3; i++) { timers.shift()(); await flush(); }
  return { states, calls, events, navigations, protectedReads };
}

const paid = await run({ replies: [
  { orderType: 'membership', status: 'created', amount: 10 },
  { orderType: 'membership', status: 'paid', amount: 10, planName: 'Student', paymentId: 'MOJO-verified', paidAt: '2026-10-03T16:43:28.381Z' },
] });
assert.equal(paid.calls.length, 2, 'pending membership keeps asking the gateway-aware endpoint');
assert.equal(paid.states[0], 'paid', 'verified membership displays the success screen');
assert.equal(paid.states[1], 10);
assert.equal(paid.states[2].planName, 'Student');
assert.equal(paid.states[2].paymentId, 'MOJO-verified', 'receipt uses the server-verified payment reference');
assert.deepEqual(paid.events, ['paymentCompleted'], 'dashboard and sidebar refresh');
assert.equal(paid.protectedReads, 0, 'no auth-dependent read after public verification');
assert.equal(paid.navigations.length, 0, 'membership success screen stays visible');

const guest = await run({ replies: [{ orderType: 'membership', status: 'paid', amount: 10 }], member: false });
assert.equal(guest.states[0], 'paid'); assert.equal(guest.protectedReads, 0);
const fallback = await run({ replies: [new Error('Old backend')], fallback: { status: 'paid', amount: 10 } });
assert.equal(fallback.states[0], 'paid'); assert.equal(fallback.protectedReads, 1);
const booking = await run({ replies: [{ orderType: 'event_booking', status: 'paid', eventSlug: 'conference', bookingRef: 'REF-1', amount: 1000 }] });
assert.equal(booking.navigations[0][0], '/member/events/conference/book?ref=REF-1');
console.log('Return-page polling, verified success screen, dashboard refresh, guest access and event routing passed.');
