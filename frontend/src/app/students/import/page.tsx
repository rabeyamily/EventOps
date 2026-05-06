'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PageLayout from '@/components/layout/PageLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { importStudentsCSV } from '@/lib/api/students';
import { useIsAdmin } from '@/hooks/useAuth';
import ImportCsvPageBackButton from '@/components/admin/ImportCsvPageBackButton';

export default function ImportStudentsPage() {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('Please select a CSV file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await importStudentsCSV(file);
      setResult(result);
      // Refresh after 2 seconds
      setTimeout(() => {
        router.push('/students');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to import CSV');
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <ProtectedRoute>
        <PageLayout title="Import Students from CSV">
          <Card>
            <CardContent>
              <p className="text-red-600">Access denied. Admin privileges required.</p>
            </CardContent>
          </Card>
        </PageLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <PageLayout
        title="Import Students from CSV"
        actions={<ImportCsvPageBackButton href="/students" label="Back to Students" />}
      >
        <Card>
          <CardHeader>
            <CardTitle>CSV Import</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
                {file && (
                  <p className="mt-2 text-sm text-gray-600">Selected: {file.name}</p>
                )}
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {result && (
                <div className="rounded-md bg-green-50 p-4">
                  <h3 className="text-sm font-medium text-green-800 mb-2">
                    Import Completed!
                  </h3>
                  <div className="text-sm text-green-700 space-y-1">
                    <p>Total rows: {result.total}</p>
                    <p>Created: {result.created}</p>
                    <p>Updated: {result.updated}</p>
                    <p>Skipped: {result.skipped}</p>
                    {result.errors && result.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium">Errors:</p>
                        <ul className="list-disc list-inside">
                          {result.errors.slice(0, 10).map((err: string, idx: number) => (
                            <li key={idx}>{err}</li>
                          ))}
                          {result.errors.length > 10 && (
                            <li>... and {result.errors.length - 10} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-4">
                <Button
                  variant="primary"
                  onClick={handleImport}
                  disabled={!file || loading}
                  isLoading={loading}
                >
                  {loading ? 'Importing...' : 'Import Students'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/students')}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>

              <div className="mt-6 rounded-md bg-blue-50 p-4">
                <h3 className="text-sm font-medium text-blue-800 mb-2">
                  CSV Format Requirements
                </h3>
                <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                  <li>Required columns: Last, First, Email</li>
                  <li>Optional: Preferred, School, Emergency Contact Name, Emergency Contact Phone, Emergency Contact Email</li>
                  <li>Campus will be determined from School field (Shanghai or NYU Abu Dhabi)</li>
                  <li>Existing students (by email) will be updated, new students will be created</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </PageLayout>
    </ProtectedRoute>
  );
}

