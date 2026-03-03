import http from 'k6/http';
import { sleep, check } from 'k6';

export let options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  const res = http.get('http://app-under-test/');
  check(res, { 'status was 200': (r) => r.status === 200 });
  sleep(1);
}
