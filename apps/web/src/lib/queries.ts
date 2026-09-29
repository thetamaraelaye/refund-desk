'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from './api';
import type {
  CustomerOrder,
  CustomerRequest,
  DemoCustomer,
  Paged,
  RequestStatus,
  Sessions,
  StaffListItem,
  StaffRequestDetail,
} from './types';

// The staff queue: one status, or the "needs attention" view (escalated and waiting, oldest first).
export interface StaffListFilters {
  status?: RequestStatus;
  view?: 'attention';
  page: number;
}

// Keys are [resource, filters]; mutations invalidate the resources they change.
export const keys = {
  session: ['session'] as const,
  demoCustomers: ['demo-customers'] as const,
  myOrders: ['my-orders'] as const,
  myRequests: ['my-requests'] as const,
  request: (id: string) => ['request', id] as const,
  staffRequests: (filters: StaffListFilters) => ['staff-requests', filters] as const,
  staffRequest: (id: string) => ['staff-request', id] as const,
};

export const useSession = () =>
  useQuery({
    queryKey: keys.session,
    queryFn: () => request<Sessions>({ url: '/auth/session' }),
  });

export const useDemoCustomers = () =>
  useQuery({
    queryKey: keys.demoCustomers,
    queryFn: () => request<DemoCustomer[]>({ url: '/auth/demo-customers' }),
    staleTime: Infinity,
  });

export function useCustomerSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (customerId: string) =>
      request({ method: 'POST', url: '/auth/customer-session', data: { customerId } }),
    // A different customer: nothing cached for the previous one may show.
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: keys.myOrders });
      queryClient.removeQueries({ queryKey: keys.myRequests });
      queryClient.removeQueries({ queryKey: ['request'] });
      return queryClient.invalidateQueries({ queryKey: keys.session });
    },
  });
}

export function useStaffSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; password: string }) =>
      request({ method: 'POST', url: '/auth/staff-session', data: body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.session }),
  });
}

export function useSignOut(role: 'customer' | 'staff') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => request({ method: 'DELETE', url: `/auth/${role}-session` }),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export const useMyOrders = () =>
  useQuery({
    queryKey: keys.myOrders,
    queryFn: () => request<CustomerOrder[]>({ url: '/me/orders' }),
  });

export const useMyRequests = () =>
  useQuery({
    queryKey: keys.myRequests,
    queryFn: () => request<CustomerRequest[]>({ url: '/requests/mine' }),
  });

// Polls while the request is open, so a specialist's ruling shows up without a refresh.
export const useCustomerRequest = (id: string | null) =>
  useQuery({
    queryKey: keys.request(id ?? ''),
    queryFn: () => request<CustomerRequest>({ url: `/requests/${id}` }),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'ESCALATED' || status === 'NEEDS_INFO' ? 5_000 : false;
    },
  });

function useRequestUpdate() {
  const queryClient = useQueryClient();
  return (updated: CustomerRequest) => {
    queryClient.setQueryData(keys.request(updated.id), updated);
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.myRequests }),
      queryClient.invalidateQueries({ queryKey: keys.myOrders }),
    ]);
  };
}

export function useSendMessage() {
  const onUpdated = useRequestUpdate();
  return useMutation({
    // Up to two model calls happen behind this, so it gets more time than a plain read.
    mutationFn: (body: { requestId?: string; message: string }) =>
      request<CustomerRequest>({
        method: 'POST',
        url: '/requests/messages',
        data: body,
        timeout: 90_000,
      }),
    onSuccess: onUpdated,
  });
}

export function useHandoff() {
  const onUpdated = useRequestUpdate();
  return useMutation({
    mutationFn: (requestId?: string) =>
      request<CustomerRequest>({
        method: 'POST',
        url: '/requests/handoff',
        data: requestId ? { requestId } : {},
        timeout: 90_000,
      }),
    onSuccess: onUpdated,
  });
}

// The dashboard refreshes itself, so a request sent from the chat appears without reloading.
export const useStaffRequests = (filters: StaffListFilters) =>
  useQuery({
    queryKey: keys.staffRequests(filters),
    queryFn: () =>
      request<Paged<StaffListItem>>({
        url: '/admin/requests',
        params: { status: filters.status, view: filters.view, page: filters.page, limit: 20 },
      }),
    refetchInterval: 5_000,
    placeholderData: (previous) => previous,
  });

export const useStaffRequest = (id: string | null) =>
  useQuery({
    queryKey: keys.staffRequest(id ?? ''),
    queryFn: () => request<StaffRequestDetail>({ url: `/admin/requests/${id}` }),
    enabled: Boolean(id),
    refetchInterval: 5_000,
  });

export function useResolveRequest(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { action: 'APPROVE' | 'DENY'; note: string }) =>
      request<StaffRequestDetail>({
        method: 'POST',
        url: `/admin/requests/${id}/resolution`,
        data: body,
      }),
    onSuccess: (detail) => {
      queryClient.setQueryData(keys.staffRequest(id), detail);
      return queryClient.invalidateQueries({ queryKey: ['staff-requests'] });
    },
  });
}
