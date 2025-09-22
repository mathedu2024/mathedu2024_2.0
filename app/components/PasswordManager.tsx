'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Swal from 'sweetalert2';

const formSchema = z.object({
  currentPassword: z.string().min(1, '請輸入目前密碼'),
  newPassword: z.string().min(6, '新密碼至少需要6個字元'),
  confirmNewPassword: z.string().min(6, '請確認新密碼'),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: '新密碼與確認密碼不符',
  path: ['confirmNewPassword'],
});

type PasswordManagerProps = {
  onPasswordChangeSuccess?: () => void;
  apiEndpoint?: string; // New prop for API endpoint
};

function PasswordManager({ onPasswordChangeSuccess, apiEndpoint = '/api/student/change-password' }: PasswordManagerProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (response.ok) {
        Swal.fire({
          title: '成功!',
          text: '密碼修改成功',
          icon: 'success',
          confirmButtonText: '好'
        });
        form.reset();
        onPasswordChangeSuccess?.();
      } else {
        Swal.fire({
          title: '錯誤',
          text: data.message || '請檢查您輸入的密碼是否正確。',
          icon: 'error',
          confirmButtonText: '好'
        });
      }
    } catch (error) {
      console.error('密碼修改錯誤:', error);
      Swal.fire({
        title: '錯誤',
        text: '修改密碼時發生錯誤，請稍後再試。',
        icon: 'error',
        confirmButtonText: '好'
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto w-full p-4 h-full flex flex-col">
      <h2 className="text-2xl font-bold mb-6 flex-shrink-0">修改密碼</h2>
      <div className="w-full">
        <div className="bg-white border border-gray-200 p-6 rounded-lg">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>目前密碼</FormLabel>
                    <FormControl>
                      <Input type="password" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>新密碼</FormLabel>
                    <FormControl>
                      <Input type="password" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmNewPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>確認新密碼</FormLabel>
                    <FormControl>
                      <Input type="password" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" loading={isLoading}>
                修改密碼
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}

export default PasswordManager;