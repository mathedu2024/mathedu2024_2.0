'use client';

import React, { useState } from 'react';
import {
  Button,
  Card,
  Input,
  Select,
  Modal,
  LoadingSpinner,
  StatsCard,
  QuickActionCard,
  UserAvatar
} from '../index';

export default function UIDemoPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectValue, setSelectValue] = useState('');

  const selectOptions = [
    { value: 'option1', label: '選項 1' },
    { value: 'option2', label: '選項 2' },
    { value: 'option3', label: '選項 3' }
  ];

  const demoIcons = {
    user: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    plus: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
    book: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    )
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">UI 元件庫示範</h1>
        
        {/* 按鈕元件 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">按鈕元件</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <h3 className="text-lg font-medium mb-4">按鈕變體</h3>
              <div className="space-y-3">
                <Button variant="primary">主要按鈕</Button>
                <Button variant="secondary">次要按鈕</Button>
                <Button variant="danger">危險按鈕</Button>
                <Button variant="success">成功按鈕</Button>
                <Button variant="warning">警告按鈕</Button>
              </div>
            </Card>

            <Card>
              <h3 className="text-lg font-medium mb-4">按鈕尺寸</h3>
              <div className="space-y-3">
                <Button size="sm">小按鈕</Button>
                <Button size="md">中按鈕</Button>
                <Button size="lg">大按鈕</Button>
              </div>
            </Card>

            <Card>
              <h3 className="text-lg font-medium mb-4">按鈕狀態</h3>
              <div className="space-y-3">
                <Button loading>載入中</Button>
                <Button disabled>已禁用</Button>
                <Button fullWidth>全寬按鈕</Button>
              </div>
            </Card>
          </div>
        </section>

        {/* 卡片元件 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">卡片元件</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <h3 className="text-lg font-medium mb-2">預設卡片</h3>
              <p className="text-gray-600">這是一個預設的卡片元件。</p>
            </Card>

            <Card color="blue">
              <h3 className="text-lg font-medium mb-2">藍色卡片</h3>
              <p className="text-gray-600">帶有藍色邊框的卡片。</p>
            </Card>

            <Card color="green" onClick={() => alert('卡片被點擊了！')} hover>
              <h3 className="text-lg font-medium mb-2">可點擊卡片</h3>
              <p className="text-gray-600">點擊此卡片會有互動效果。</p>
            </Card>
          </div>
        </section>

        {/* 表單元件 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">表單元件</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <h3 className="text-lg font-medium mb-4">輸入框</h3>
              <div className="space-y-4">
                <Input
                  label="用戶名"
                  placeholder="請輸入用戶名"
                  value={inputValue}
                  onChange={setInputValue}
                  required
                />
                <Input
                  type="email"
                  label="電子郵件"
                  placeholder="請輸入電子郵件"
                  error="請輸入有效的電子郵件"
                />
                <Input
                  type="password"
                  label="密碼"
                  placeholder="請輸入密碼"
                />
              </div>
            </Card>

            <Card>
              <h3 className="text-lg font-medium mb-4">下拉選單</h3>
              <div className="space-y-4">
                <Select
                  label="選擇選項"
                  options={selectOptions}
                  value={selectValue}
                  onChange={setSelectValue}
                  placeholder="請選擇一個選項"
                />
                <Select
                  label="必填選項"
                  options={selectOptions}
                  required
                  error="請選擇一個選項"
                />
              </div>
            </Card>
          </div>
        </section>

        {/* 統計卡片 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">統計卡片</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              title="總用戶數"
              value="1,234"
              icon={demoIcons.user}
              color="blue"
              trend="up"
              trendValue="+12%"
            />
            <StatsCard
              title="總課程數"
              value="56"
              icon={demoIcons.book}
              color="green"
              trend="up"
              trendValue="+5%"
            />
            <StatsCard
              title="活躍用戶"
              value="892"
              icon={demoIcons.user}
              color="yellow"
              trend="down"
              trendValue="-3%"
            />
            <StatsCard
              title="完成率"
              value="94%"
              icon={demoIcons.plus}
              color="purple"
              trend="neutral"
              trendValue="0%"
            />
          </div>
        </section>

        {/* 快速操作卡片 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">快速操作卡片</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <QuickActionCard
              title="新增課程"
              description="建立新的課程"
              icon={demoIcons.plus}
              onClick={() => alert('新增課程')}
              color="green"
            />
            <QuickActionCard
              title="管理用戶"
              description="查看和管理用戶"
              icon={demoIcons.user}
              onClick={() => alert('管理用戶')}
              color="blue"
            />
            <QuickActionCard
              title="查看報告"
              description="查看系統報告"
              icon={demoIcons.book}
              onClick={() => alert('查看報告')}
              color="purple"
            />
          </div>
        </section>

        {/* 用戶頭像 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">用戶頭像</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <h3 className="text-lg font-medium mb-4">不同尺寸</h3>
              <div className="space-y-4">
                <UserAvatar name="張三" role="老師" size="sm" />
                <UserAvatar name="李四" role="學生" size="md" />
                <UserAvatar name="王五" role="管理員" size="lg" />
                <UserAvatar name="趙六" role="老師" size="xl" />
              </div>
            </Card>

            <Card>
              <h3 className="text-lg font-medium mb-4">完整資訊</h3>
              <UserAvatar
                name="張三"
                role="老師"
                email="zhang@example.com"
                size="lg"
              />
            </Card>

            <Card>
              <h3 className="text-lg font-medium mb-4">可點擊頭像</h3>
              <UserAvatar
                name="李四"
                role="學生"
                size="lg"
                onClick={() => alert('用戶頭像被點擊了！')}
              />
            </Card>
          </div>
        </section>

        {/* 載入動畫 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">載入動畫</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <h3 className="text-lg font-medium mb-4">不同尺寸</h3>
              <div className="space-y-4">
                <LoadingSpinner size="xs" />
                <LoadingSpinner size="sm" />
                <LoadingSpinner size="md" />
                <LoadingSpinner size="lg" />
                <LoadingSpinner size="xl" />
              </div>
            </Card>

            <Card>
              <h3 className="text-lg font-medium mb-4">帶文字</h3>
              <div className="space-y-4">
                <LoadingSpinner size="md" text="載入中..." />
                <LoadingSpinner size="lg" text="請稍候..." />
              </div>
            </Card>

            <Card>
              <h3 className="text-lg font-medium mb-4">不同顏色</h3>
              <div className="space-y-4">
                <LoadingSpinner size="md" color="blue" />
                <LoadingSpinner size="md" color="gray" />
                <LoadingSpinner size="md" color="white" />
              </div>
            </Card>
          </div>
        </section>

        {/* 模態框 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">模態框</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <h3 className="text-lg font-medium mb-4">開啟模態框</h3>
              <Button onClick={() => setIsModalOpen(true)}>
                開啟模態框
              </Button>
            </Card>
          </div>
        </section>

        {/* 模態框 */}
        <Modal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="示範模態框"
          size="lg"
        >
          <div className="space-y-4">
            <p>這是一個示範模態框，展示了 Modal 元件的功能。</p>
            <p>您可以點擊背景或關閉按鈕來關閉此模態框。</p>
            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                取消
              </Button>
              <Button onClick={() => setIsModalOpen(false)}>
                確認
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
} 