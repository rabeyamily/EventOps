'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import PageLayout from '@/components/layout/PageLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button, Card, Modal, Input, Select, Spinner } from '@/components/ui';
import {
  getDocuments,
  createDocument,
  uploadDocument,
  updateDocument,
  deleteDocument,
  Document,
  DocumentCategory,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  detectCategory,
  formatFileSize,
} from '@/lib/api/documents';
import { useIsAdmin } from '@/hooks/useAuth';

const CATEGORY_OPTIONS = [
  { value: 'presentation', label: '📊 Presentation' },
  { value: 'pdf', label: '📄 PDF' },
  { value: 'spreadsheet', label: '📋 Spreadsheet' },
  { value: 'video', label: '🎥 Video' },
  { value: 'link', label: '🔗 Link' },
  { value: 'other', label: '📁 Other' },
];

const CATEGORY_COLORS: Record<DocumentCategory, string> = {
  presentation: 'bg-purple-100 text-purple-700',
  pdf: 'bg-red-100 text-red-700',
  spreadsheet: 'bg-green-100 text-green-700',
  video: 'bg-blue-100 text-blue-700',
  link: 'bg-gray-100 text-gray-700',
  other: 'bg-yellow-100 text-yellow-700',
};

const emptyForm = {
  title: '',
  description: '',
  url: '',
  category: 'link' as DocumentCategory,
  cohort: '',
};

type ModalTab = 'upload' | 'link';

export default function DocumentsPage() {
  const isAdmin = useIsAdmin();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTab>('upload');
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<Document | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDocuments();
      setDocuments(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
      hasLoadedOnce.current = true;
    }
  };

  useEffect(() => { fetchDocuments(); }, []);

  const openAddModal = () => {
    setEditingDoc(null);
    setFormData(emptyForm);
    setSelectedFile(null);
    setFormError(null);
    setModalTab('upload');
    setShowModal(true);
  };

  const openEditModal = (doc: Document) => {
    setEditingDoc(doc);
    setFormData({
      title: doc.title,
      description: doc.description || '',
      url: doc.sourceType === 'link' ? doc.url : '',
      category: doc.category,
      cohort: doc.cohort || '',
    });
    setSelectedFile(null);
    setFormError(null);
    setModalTab(doc.sourceType === 'upload' ? 'upload' : 'link');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingDoc(null);
    setFormData(emptyForm);
    setSelectedFile(null);
    setFormError(null);
    setUploadProgress(0);
  };

  const handleFormChange = (key: keyof typeof emptyForm, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setFormError(null);
    // Auto-fill title from filename (strip extension)
    if (!formData.title) {
      const name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
      setFormData((prev) => ({
        ...prev,
        title: name,
        category: detectCategory(file.name),
      }));
    } else {
      setFormData((prev) => ({ ...prev, category: detectCategory(file.name) }));
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }, [formData.title]);

  const handleSave = async () => {
    setFormError(null);
    if (!formData.title.trim()) {
      setFormError('Title is required.');
      return;
    }

    setSaving(true);
    try {
      if (editingDoc) {
        // Editing — only update metadata fields (no re-upload in edit mode)
        const payload: any = {
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          category: formData.category,
          cohort: formData.cohort.trim() || undefined,
        };
        if (editingDoc.sourceType === 'link') {
          if (!formData.url.trim()) { setFormError('URL is required.'); setSaving(false); return; }
          try { new URL(formData.url.trim()); } catch { setFormError('Please enter a valid URL.'); setSaving(false); return; }
          payload.url = formData.url.trim();
        }
        const updated = await updateDocument(editingDoc.id, payload);
        setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      } else if (modalTab === 'upload') {
        if (!selectedFile) { setFormError('Please select a file to upload.'); setSaving(false); return; }
        const created = await uploadDocument(selectedFile, {
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          category: formData.category,
          cohort: formData.cohort.trim() || undefined,
        });
        setDocuments((prev) => [created, ...prev]);
      } else {
        if (!formData.url.trim()) { setFormError('URL is required.'); setSaving(false); return; }
        try { new URL(formData.url.trim()); } catch { setFormError('Please enter a valid URL (e.g. https://...).'); setSaving(false); return; }
        const created = await createDocument({
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          url: formData.url.trim(),
          category: formData.category,
          cohort: formData.cohort.trim() || undefined,
        });
        setDocuments((prev) => [created, ...prev]);
      }
      closeModal();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save document');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingDoc) return;
    setDeleting(true);
    try {
      await deleteDocument(deletingDoc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== deletingDoc.id));
      setShowDeleteModal(false);
      setDeletingDoc(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete document');
    } finally {
      setDeleting(false);
    }
  };

  const getDocumentHref = (doc: Document) => {
    if (doc.sourceType === 'upload') {
      return `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${doc.url}`;
    }
    return doc.url;
  };

  if (loading && !hasLoadedOnce.current) {
    return (
      <ProtectedRoute>
        <PageLayout title="Documents">
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-[#57068c]" />
          </div>
        </PageLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <PageLayout
        title="Documents"
        actions={
          isAdmin ? (
            <Button variant="primary" size="sm" onClick={openAddModal} className="text-xs sm:text-sm">
              + Add Document
            </Button>
          ) : null
        }
      >
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 border border-red-200">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {loading && hasLoadedOnce.current && (
          <div className="flex justify-center py-4">
            <Spinner size="sm" className="text-[#57068c]" />
          </div>
        )}

        {!loading && documents.length === 0 ? (
          <Card>
            <div className="py-12 sm:py-16 text-center">
              <div className="text-4xl mb-3">📁</div>
              <p className="text-gray-600 font-medium mb-1">No documents yet</p>
              {isAdmin ? (
                <>
                  <p className="text-sm text-gray-400 mb-4">
                    Upload PDFs, Excel sheets, slides, or add links to any resource.
                  </p>
                  <Button variant="primary" onClick={openAddModal}>
                    Add First Document
                  </Button>
                </>
              ) : (
                <p className="text-sm text-gray-400">Documents added by admins will appear here.</p>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-2 hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl flex-shrink-0">{CATEGORY_ICONS[doc.category]}</span>
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate leading-tight">
                      {doc.title}
                    </h3>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => openEditModal(doc)}
                        className="p-1.5 rounded-md text-gray-500 hover:text-[#57068c] hover:bg-purple-50 transition-colors"
                        title="Edit"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => { setDeletingDoc(doc); setShowDeleteModal(true); }}
                        className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[doc.category]}`}>
                    {CATEGORY_LABELS[doc.category]}
                  </span>
                  {doc.sourceType === 'upload' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                      ⬆ Uploaded
                    </span>
                  )}
                  {doc.cohort && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                      {doc.cohort}
                    </span>
                  )}
                </div>

                {/* Description */}
                {doc.description && (
                  <p className="text-xs sm:text-sm text-gray-500 line-clamp-2">{doc.description}</p>
                )}

                {/* File info for uploads */}
                {doc.sourceType === 'upload' && (doc.fileName || doc.fileSize) && (
                  <p className="text-[10px] text-gray-400 truncate">
                    {doc.fileName}
                    {doc.fileSize ? ` · ${formatFileSize(doc.fileSize)}` : ''}
                  </p>
                )}

                {/* Open / Download link */}
                <div className="mt-auto pt-1">
                  <a
                    href={getDocumentHref(doc)}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={doc.sourceType === 'upload' ? (doc.fileName || true) : undefined}
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#57068c] hover:underline"
                  >
                    {doc.sourceType === 'upload' ? 'Download' : 'Open'}
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {doc.sourceType === 'upload' ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      )}
                    </svg>
                  </a>
                </div>

                {doc.uploadedBy && (
                  <p className="text-[10px] text-gray-400">Added by {doc.uploadedBy.fullName}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add / Edit Modal */}
        <Modal
          isOpen={showModal}
          onClose={closeModal}
          size="md"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button variant="outline" size="sm" onClick={closeModal} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave} isLoading={saving} disabled={saving}>
                {editingDoc ? 'Save Changes' : modalTab === 'upload' ? 'Upload' : 'Add Link'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">
              {editingDoc ? 'Edit Document' : 'Add Document'}
            </h2>

            {/* Tabs — only for new documents */}
            {!editingDoc && (
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                <button
                  type="button"
                  onClick={() => { setModalTab('upload'); setFormError(null); }}
                  className={`flex-1 py-2 font-medium transition-colors ${
                    modalTab === 'upload'
                      ? 'bg-[#57068c] text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  ⬆ Upload File
                </button>
                <button
                  type="button"
                  onClick={() => { setModalTab('link'); setFormError(null); }}
                  className={`flex-1 py-2 font-medium transition-colors ${
                    modalTab === 'link'
                      ? 'bg-[#57068c] text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  🔗 Add Link
                </button>
              </div>
            )}

            {formError && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-800">{formError}</p>
              </div>
            )}

            {/* Upload tab: file drop zone */}
            {!editingDoc && modalTab === 'upload' && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer py-8 transition-colors ${
                  dragOver
                    ? 'border-[#57068c] bg-purple-50'
                    : selectedFile
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-gray-300 bg-gray-50 hover:border-[#57068c] hover:bg-purple-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="*/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />
                {selectedFile ? (
                  <>
                    <span className="text-2xl">{CATEGORY_ICONS[detectCategory(selectedFile.name)]}</span>
                    <p className="text-sm font-medium text-gray-900 text-center px-4 truncate max-w-full">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                    <p className="text-xs text-emerald-600 font-medium">✓ Ready to upload</p>
                  </>
                ) : (
                  <>
                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm font-medium text-gray-700">Drop file here or click to browse</p>
                    <p className="text-xs text-gray-400">PDF, Excel, Word, PowerPoint, images, video — up to 50 MB</p>
                  </>
                )}
              </div>
            )}

            {/* Link tab: URL field */}
            {(modalTab === 'link' || (editingDoc && editingDoc.sourceType === 'link')) && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  URL <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.url}
                  onChange={(e) => handleFormChange('url', e.target.value)}
                  placeholder="https://docs.google.com/..."
                  type="url"
                />
              </div>
            )}

            {/* Editing an uploaded file — show current file info, no re-upload */}
            {editingDoc && editingDoc.sourceType === 'upload' && (
              <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <span className="text-lg">{CATEGORY_ICONS[editingDoc.category]}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{editingDoc.fileName || editingDoc.title}</p>
                  {editingDoc.fileSize && (
                    <p className="text-xs text-gray-500">{formatFileSize(editingDoc.fileSize)}</p>
                  )}
                </div>
              </div>
            )}

            {/* Common fields */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.title}
                onChange={(e) => handleFormChange('title', e.target.value)}
                placeholder="e.g. Fall 2025 Orientation Slides"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                <Select
                  value={formData.category}
                  onChange={(e) => handleFormChange('category', e.target.value)}
                  options={CATEGORY_OPTIONS}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Semester (optional)</label>
                <Input
                  value={formData.cohort}
                  onChange={(e) => handleFormChange('cohort', e.target.value)}
                  placeholder="e.g. Fall 2025"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description (optional)</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
                placeholder="Brief description..."
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#57068c] focus:outline-none focus:ring-1 focus:ring-[#57068c]"
              />
            </div>
          </div>
        </Modal>

        {/* Delete confirmation */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => { setShowDeleteModal(false); setDeletingDoc(null); }}
          size="sm"
          footer={
            <div className="flex gap-2 justify-center w-full">
              <Button variant="outline" size="sm" onClick={() => { setShowDeleteModal(false); setDeletingDoc(null); }} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleDeleteConfirm} isLoading={deleting} className="bg-red-600 hover:bg-red-700 text-white">
                Delete
              </Button>
            </div>
          }
        >
          <p className="text-center text-gray-700">
            Delete <span className="font-semibold">&ldquo;{deletingDoc?.title}&rdquo;</span>?
            {deletingDoc?.sourceType === 'upload' && (
              <span className="block text-sm text-gray-500 mt-1">The uploaded file will also be permanently removed.</span>
            )}
          </p>
        </Modal>
      </PageLayout>
    </ProtectedRoute>
  );
}
