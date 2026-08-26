import { apiFetch } from "@/services/activApi";
import axios from 'axios';

// Empty: apiFetch prefixes the real API base.
const API_BASE_URL = '';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Initiate payment for approved application
 */
export const initiatePayment = async (paymentData: {
  planType: string;
  planAmount: number;
  supportAmount: number;
  totalAmount: number;
}) => {
  try {
    const response = await api.post('/payment/initiate', paymentData);
    return response.data;
  } catch (error: any) {
    console.error('Error initiating payment:', error);
    throw new Error(
      error.response?.data?.message || 'Failed to initiate payment'
    );
  }
};

/**
 * Verify payment after completion
 */
export const verifyPayment = async (verificationData: {
  paymentId: string;
  paymentMethod: string;
  transactionId: string;
  status: string;
}) => {
  try {
    const response = await api.post('/payment/verify', verificationData);
    return response.data;
  } catch (error: any) {
    console.error('Error verifying payment:', error);
    throw new Error(
      error.response?.data?.message || 'Failed to verify payment'
    );
  }
};

/**
 * Get payment history for current user
 */
export const getPaymentHistory = async () => {
  try {
    const response = await api.get('/payment/history');
    return response.data;
  } catch (error: any) {
    console.error('Error fetching payment history:', error);
    throw new Error(
      error.response?.data?.message || 'Failed to fetch payment history'
    );
  }
};

/**
 * Get specific payment details
 */
export const getPaymentDetails = async (paymentId: string) => {
  try {
    const response = await api.get(`/payment/${paymentId}`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching payment details:', error);
    throw new Error(
      error.response?.data?.message || 'Failed to fetch payment details'
    );
  }
};
