import axios from 'axios';
import { API_BASE_URL, API_TIMEOUT } from '../config/api.config';

/** Public reads and guest bookings must not inherit an account's credentials. */
const publicApi = axios.create({ baseURL: API_BASE_URL, timeout: API_TIMEOUT, withCredentials: false });
export default publicApi;
