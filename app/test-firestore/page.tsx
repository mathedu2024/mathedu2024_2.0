'use client';

import { useState } from 'react';

export default function TestFirestore() {
  const [result, setResult] = useState<string | number | boolean | React.ReactNode | null>(null);
  const [loading, setLoading] = useState(false);

  const testFirestore = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test-firestore');
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult(JSON.stringify({ error: error instanceof Error ? error.message : '未知錯誤' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Firestore 連線測試</h1>
      
      <button 
        onClick={testFirestore}
        disabled={loading}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4"
      >
        {loading ? '測試中...' : '測試 Firestore 連線'}
      </button>

      {result && (
        <div className="mt-4">
          <h2 className="text-lg font-semibold mb-2">測試結果:</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
} 