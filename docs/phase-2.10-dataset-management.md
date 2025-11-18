# Phase 2.10: Dataset Management in Labeler

**Status**: 📋 Planning
**Priority**: High
**Timeline**: 5 weeks
**Goal**: Enable dataset upload/delete in Labeler, preparing for Platform migration

---

## 📊 Current Situation

### Problem
- **det-mvtec dataset** has corrupted annotations.json (file_name: '1', '2', '3' instead of actual paths)
- No way to delete/re-upload datasets from Labeler
- All dataset management happens in Platform (separate system)

### Current Architecture
```
┌─────────────────┐         ┌──────────────────┐
│    Platform     │ ──────> │     Labeler      │
│                 │         │                  │
│ ✓ Upload        │         │ ✗ Read only      │
│ ✓ Delete        │         │ ✓ Annotate       │
│ ✓ Manage        │         │ ✓ Export         │
└─────────────────┘         └──────────────────┘
```

### Target Architecture
```
┌─────────────────┐         ┌──────────────────┐
│    Platform     │ <────── │     Labeler      │
│                 │         │                  │
│ (Legacy)        │         │ ✓ Upload     ✨  │
│                 │         │ ✓ Delete     ✨  │
│                 │         │ ✓ Annotate       │
│                 │         │ ✓ Export         │
└─────────────────┘         └──────────────────┘
```

---

## 🎯 Implementation Plan

### Phase 2.10.1: Dataset Deletion (Week 1)

**Priority**: ⚡ Critical (blocks current work)

#### Backend Implementation

**File**: `backend/app/api/v1/endpoints/datasets.py`

**New Endpoint**:
```python
@router.delete("/{dataset_id}", tags=["Datasets"])
async def delete_dataset(
    dataset_id: str,
    delete_request: DeleteDatasetRequest,
    platform_db: Session = Depends(get_platform_db),
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
) -> DeleteDatasetResponse:
    """
    Delete dataset and all related data.

    Deletion cascade:
    1. Verify permissions (owner or admin)
    2. Check confirmation (dataset name must match)
    3. Optional: Create backup export
    4. Delete Labeler DB data (cascade)
    5. Delete S3 files (images + annotations)
    6. Delete Platform DB record
    7. Return deletion summary

    Args:
        dataset_id: Dataset ID to delete
        delete_request: Deletion request with confirmation

    Returns:
        Deletion summary with counts

    Raises:
        403: User not authorized
        404: Dataset not found
        400: Confirmation failed
    """
```

**Request Schema**:
```python
class DeleteDatasetRequest(BaseModel):
    """Dataset deletion request."""
    confirm_dataset_name: str  # Must match dataset.name exactly
    create_backup: bool = True  # Export before deletion
    force_delete: bool = False  # Skip safety checks (admin only)

class DeleteDatasetResponse(BaseModel):
    """Dataset deletion response."""
    dataset_id: str
    dataset_name: str
    deleted_at: datetime
    backup_path: Optional[str] = None
    deletion_summary: DeletionSummary

class DeletionSummary(BaseModel):
    """Summary of deleted data."""
    images_deleted: int
    annotations_deleted: int
    versions_deleted: int
    projects_deleted: int
    storage_bytes_freed: int
    s3_keys_deleted: List[str]
```

**Deletion Flow**:
```python
async def delete_dataset(dataset_id: str, delete_request: DeleteDatasetRequest):
    # Step 1: Verify permissions
    dataset = get_dataset_or_404(platform_db, dataset_id)
    if dataset.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(403, "Not authorized to delete this dataset")

    # Step 2: Verify confirmation
    if delete_request.confirm_dataset_name != dataset.name:
        raise HTTPException(400, "Dataset name confirmation failed")

    # Step 3: Get deletion impact
    impact = calculate_deletion_impact(labeler_db, platform_db, dataset_id)

    # Step 4: Optional backup
    backup_path = None
    if delete_request.create_backup:
        backup_path = create_final_backup(dataset_id, impact)

    # Step 5: Delete Labeler DB data (cascade)
    deleted_counts = delete_labeler_data(labeler_db, dataset_id)

    # Step 6: Delete S3 data
    s3_keys = delete_s3_data(dataset_id, impact.project_ids)

    # Step 7: Delete Platform DB record
    platform_db.delete(dataset)
    platform_db.commit()

    # Step 8: Return summary
    return DeleteDatasetResponse(
        dataset_id=dataset_id,
        dataset_name=dataset.name,
        deleted_at=datetime.utcnow(),
        backup_path=backup_path,
        deletion_summary=DeletionSummary(
            images_deleted=deleted_counts['images'],
            annotations_deleted=deleted_counts['annotations'],
            versions_deleted=deleted_counts['versions'],
            projects_deleted=deleted_counts['projects'],
            storage_bytes_freed=impact.storage_bytes,
            s3_keys_deleted=s3_keys
        )
    )
```

**Service Layer**:
**File**: `backend/app/services/dataset_delete_service.py`

```python
def calculate_deletion_impact(
    labeler_db: Session,
    platform_db: Session,
    dataset_id: str
) -> DeletionImpact:
    """Calculate what will be deleted."""
    # Get all projects for this dataset
    projects = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.dataset_id == dataset_id
    ).all()

    project_ids = [p.id for p in projects]

    # Count annotations
    annotations_count = labeler_db.query(Annotation).filter(
        Annotation.project_id.in_(project_ids)
    ).count()

    # Count versions
    versions_count = labeler_db.query(AnnotationVersion).filter(
        AnnotationVersion.project_id.in_(project_ids)
    ).count()

    # Calculate S3 storage size
    storage_bytes = calculate_s3_storage_size(dataset_id, project_ids)

    return DeletionImpact(
        project_ids=project_ids,
        projects_count=len(projects),
        annotations_count=annotations_count,
        versions_count=versions_count,
        storage_bytes=storage_bytes
    )

def delete_labeler_data(labeler_db: Session, dataset_id: str) -> Dict[str, int]:
    """Delete all Labeler DB data for dataset."""
    projects = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.dataset_id == dataset_id
    ).all()

    project_ids = [p.id for p in projects]

    # Count before deletion
    counts = {
        'annotations': labeler_db.query(Annotation).filter(
            Annotation.project_id.in_(project_ids)
        ).count(),
        'versions': labeler_db.query(AnnotationVersion).filter(
            AnnotationVersion.project_id.in_(project_ids)
        ).count(),
        'snapshots': labeler_db.query(AnnotationSnapshot).filter(
            AnnotationSnapshot.project_id.in_(project_ids)
        ).count(),
        'image_status': labeler_db.query(ImageAnnotationStatus).filter(
            ImageAnnotationStatus.project_id.in_(project_ids)
        ).count(),
        'projects': len(projects)
    }

    # Delete in correct order (reverse FK dependencies)
    # 1. Snapshots
    labeler_db.query(AnnotationSnapshot).filter(
        AnnotationSnapshot.project_id.in_(project_ids)
    ).delete(synchronize_session=False)

    # 2. Annotations
    labeler_db.query(Annotation).filter(
        Annotation.project_id.in_(project_ids)
    ).delete(synchronize_session=False)

    # 3. Image status
    labeler_db.query(ImageAnnotationStatus).filter(
        ImageAnnotationStatus.project_id.in_(project_ids)
    ).delete(synchronize_session=False)

    # 4. Versions
    labeler_db.query(AnnotationVersion).filter(
        AnnotationVersion.project_id.in_(project_ids)
    ).delete(synchronize_session=False)

    # 5. Projects
    for project in projects:
        labeler_db.delete(project)

    labeler_db.commit()

    return counts

def delete_s3_data(dataset_id: str, project_ids: List[str]) -> List[str]:
    """Delete all S3 data for dataset."""
    from app.core.storage import storage_client

    deleted_keys = []

    # 1. Delete dataset images and annotations
    prefix = f"datasets/{dataset_id}/"
    keys = storage_client.list_objects(
        bucket=storage_client.datasets_bucket,
        prefix=prefix
    )

    for key in keys:
        storage_client.delete_object(
            bucket=storage_client.datasets_bucket,
            key=key
        )
        deleted_keys.append(key)

    # 2. Delete export versions for all projects
    for project_id in project_ids:
        prefix = f"exports/{project_id}/"
        keys = storage_client.list_objects(
            bucket=storage_client.annotations_bucket,
            prefix=prefix
        )

        for key in keys:
            storage_client.delete_object(
                bucket=storage_client.annotations_bucket,
                key=key
            )
            deleted_keys.append(key)

    return deleted_keys

def create_final_backup(dataset_id: str, impact: DeletionImpact) -> str:
    """Create final backup export before deletion."""
    # Export all projects to a backup location
    backup_key = f"backups/{dataset_id}/{datetime.utcnow().isoformat()}/complete.zip"

    # TODO: Implement comprehensive backup
    # - All images
    # - All annotation versions
    # - Project metadata

    return backup_key
```

#### Frontend Implementation

**File**: `frontend/app/datasets/page.tsx`

**UI Changes**:
```tsx
// Add delete button to dataset card
<DatasetCard dataset={dataset}>
  <CardActions>
    <button onClick={() => router.push(`/annotation/${project.id}`)}>
      Open
    </button>
    <button
      onClick={() => setDeleteModalOpen(true)}
      className="text-red-600 hover:text-red-800"
    >
      Delete
    </button>
  </CardActions>
</DatasetCard>

// Delete confirmation modal
{deleteModalOpen && (
  <DeleteDatasetModal
    dataset={selectedDataset}
    onConfirm={handleDelete}
    onCancel={() => setDeleteModalOpen(false)}
  />
)}
```

**File**: `frontend/components/datasets/DeleteDatasetModal.tsx`

```tsx
export function DeleteDatasetModal({ dataset, onConfirm, onCancel }) {
  const [confirmName, setConfirmName] = useState('');
  const [createBackup, setCreateBackup] = useState(true);
  const [deletionImpact, setDeletionImpact] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load deletion impact on mount
  useEffect(() => {
    async function loadImpact() {
      const impact = await apiClient.get(
        `/api/v1/datasets/${dataset.id}/deletion-impact`
      );
      setDeletionImpact(impact);
    }
    loadImpact();
  }, [dataset.id]);

  const handleConfirm = async () => {
    if (confirmName !== dataset.name) {
      toast.error('Dataset name does not match');
      return;
    }

    setIsDeleting(true);

    try {
      const response = await apiClient.delete(
        `/api/v1/datasets/${dataset.id}`,
        {
          confirm_dataset_name: confirmName,
          create_backup: createBackup,
        }
      );

      toast.success(`Dataset "${dataset.name}" deleted successfully`);
      onConfirm(response);

    } catch (error) {
      toast.error(`Failed to delete dataset: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal>
      <ModalHeader>
        <h2>Delete Dataset: {dataset.name}</h2>
        <p className="text-red-600">This action cannot be undone</p>
      </ModalHeader>

      <ModalBody>
        {/* Deletion Impact Summary */}
        {deletionImpact && (
          <section>
            <h3>Deletion Impact</h3>
            <ul>
              <li>📁 Images: {deletionImpact.images_count}</li>
              <li>📝 Annotations: {deletionImpact.annotations_count}</li>
              <li>📦 Versions: {deletionImpact.versions_count}</li>
              <li>🗂️ Projects: {deletionImpact.projects_count}</li>
              <li>💾 Storage: {formatBytes(deletionImpact.storage_bytes)}</li>
            </ul>
          </section>
        )}

        {/* Backup Option */}
        <section>
          <Checkbox
            checked={createBackup}
            onChange={(e) => setCreateBackup(e.target.checked)}
          >
            Create backup export before deletion
          </Checkbox>
        </section>

        {/* Confirmation Input */}
        <section>
          <label>
            Type dataset name to confirm: <strong>{dataset.name}</strong>
          </label>
          <input
            type="text"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder="Enter dataset name"
          />
        </section>
      </ModalBody>

      <ModalFooter>
        <button onClick={onCancel} disabled={isDeleting}>
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={confirmName !== dataset.name || isDeleting}
          className="bg-red-600 text-white"
        >
          {isDeleting ? 'Deleting...' : 'Delete Dataset'}
        </button>
      </ModalFooter>
    </Modal>
  );
}
```

**API Client**:
**File**: `frontend/lib/api/datasets.ts`

```typescript
export async function deleteDataset(
  datasetId: string,
  request: DeleteDatasetRequest
): Promise<DeleteDatasetResponse> {
  return apiClient.delete<DeleteDatasetResponse>(
    `/api/v1/datasets/${datasetId}`,
    request
  );
}

export async function getDeletionImpact(
  datasetId: string
): Promise<DeletionImpact> {
  return apiClient.get<DeletionImpact>(
    `/api/v1/datasets/${datasetId}/deletion-impact`
  );
}

export interface DeleteDatasetRequest {
  confirm_dataset_name: string;
  create_backup?: boolean;
  force_delete?: boolean;
}

export interface DeleteDatasetResponse {
  dataset_id: string;
  dataset_name: string;
  deleted_at: string;
  backup_path?: string;
  deletion_summary: DeletionSummary;
}

export interface DeletionSummary {
  images_deleted: number;
  annotations_deleted: number;
  versions_deleted: number;
  projects_deleted: number;
  storage_bytes_freed: number;
  s3_keys_deleted: string[];
}
```

---

### Phase 2.10.2: Dataset Upload (Week 2-3)

**Priority**: 🔥 High

#### Backend Implementation

**File**: `backend/app/api/v1/endpoints/datasets.py`

**New Endpoint**:
```python
@router.post("/upload", tags=["Datasets"])
async def upload_dataset(
    dataset_name: str = Form(...),
    dataset_description: Optional[str] = Form(None),
    files: List[UploadFile] = File(...),
    annotation_file: Optional[UploadFile] = File(None),
    platform_db: Session = Depends(get_platform_db),
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
) -> DatasetUploadResponse:
    """
    Upload new dataset with images and optional annotations.

    Supports:
    - Multiple image files (jpg, png, etc.)
    - ZIP archive with folder structure
    - Optional annotations.json (COCO/DICE/YOLO format)

    Process:
    1. Validate files and name uniqueness
    2. Create dataset record in Platform DB
    3. Upload images to S3 (preserve folder structure)
    4. Parse and upload annotations if provided
    5. Auto-create project in Labeler DB
    6. Import annotations to Labeler DB if provided
    7. Return upload summary
    """
```

**Upload Flow**:
```python
async def upload_dataset(...):
    # Step 1: Validate
    validate_dataset_name(platform_db, dataset_name, current_user.id)
    validate_files(files)

    # Step 2: Create dataset record
    dataset_id = str(uuid.uuid4())
    dataset = Dataset(
        id=dataset_id,
        name=dataset_name,
        description=dataset_description,
        owner_id=current_user.id,
        storage_type='upload',
        storage_path=f'datasets/{dataset_id}/',
        num_images=0,
        labeled=False,
        created_at=datetime.utcnow()
    )
    platform_db.add(dataset)
    platform_db.flush()  # Get ID

    # Step 3: Handle file upload
    upload_result = await upload_files_to_s3(
        dataset_id=dataset_id,
        files=files,
        preserve_structure=True
    )

    # Update image count
    dataset.num_images = upload_result.images_count

    # Step 4: Handle annotations if provided
    annotations_data = None
    if annotation_file:
        annotations_data = await parse_annotation_file(annotation_file)

        # Upload to S3
        annotation_path = f"datasets/{dataset_id}/annotations_detection.json"
        storage_client.put_object(
            bucket=storage_client.datasets_bucket,
            key=annotation_path,
            body=json.dumps(annotations_data).encode('utf-8')
        )

        dataset.annotation_path = annotation_path
        dataset.labeled = True

    platform_db.commit()

    # Step 5: Auto-create project
    project = create_project_for_dataset(
        labeler_db=labeler_db,
        platform_db=platform_db,
        dataset=dataset,
        annotations_data=annotations_data,
        current_user=current_user
    )

    # Step 6: Import annotations if provided
    if annotations_data:
        import_result = import_annotations_to_db(
            labeler_db=labeler_db,
            project_id=project.id,
            annotations_data=annotations_data,
            current_user=current_user
        )

    return DatasetUploadResponse(
        dataset_id=dataset.id,
        dataset_name=dataset.name,
        project_id=project.id,
        upload_summary=UploadSummary(
            images_uploaded=upload_result.images_count,
            folder_structure=upload_result.folder_structure,
            annotations_imported=import_result.count if annotations_data else 0,
            storage_bytes_used=upload_result.total_bytes
        )
    )
```

**Service Layer**:
**File**: `backend/app/services/dataset_upload_service.py`

```python
async def upload_files_to_s3(
    dataset_id: str,
    files: List[UploadFile],
    preserve_structure: bool = True
) -> UploadResult:
    """Upload files to S3 with optional folder structure preservation."""

    images_count = 0
    total_bytes = 0
    folder_structure = {}

    for file in files:
        # Handle ZIP files
        if file.filename.endswith('.zip'):
            # Extract and upload with structure
            result = await upload_zip_with_structure(dataset_id, file)
            images_count += result.images_count
            total_bytes += result.total_bytes
            folder_structure.update(result.folder_structure)

        # Handle individual images
        elif is_image_file(file.filename):
            # Determine S3 key
            if preserve_structure and '/' in file.filename:
                # Keep folder structure
                s3_key = f"datasets/{dataset_id}/images/{file.filename}"
            else:
                # Flat structure
                s3_key = f"datasets/{dataset_id}/images/{os.path.basename(file.filename)}"

            # Upload to S3
            content = await file.read()
            storage_client.put_object(
                bucket=storage_client.datasets_bucket,
                key=s3_key,
                body=content
            )

            images_count += 1
            total_bytes += len(content)

            # Track folder structure
            if '/' in file.filename:
                folder = os.path.dirname(file.filename)
                if folder not in folder_structure:
                    folder_structure[folder] = 0
                folder_structure[folder] += 1

    return UploadResult(
        images_count=images_count,
        total_bytes=total_bytes,
        folder_structure=folder_structure
    )

async def upload_zip_with_structure(
    dataset_id: str,
    zip_file: UploadFile
) -> UploadResult:
    """Extract ZIP and upload with folder structure."""
    import zipfile
    import io

    images_count = 0
    total_bytes = 0
    folder_structure = {}

    # Read ZIP into memory
    zip_content = await zip_file.read()
    zip_buffer = io.BytesIO(zip_content)

    with zipfile.ZipFile(zip_buffer) as zf:
        for member in zf.namelist():
            # Skip directories and hidden files
            if member.endswith('/') or member.startswith('.'):
                continue

            # Check if image file
            if not is_image_file(member):
                continue

            # Read file content
            content = zf.read(member)

            # Upload to S3 with structure
            s3_key = f"datasets/{dataset_id}/images/{member}"
            storage_client.put_object(
                bucket=storage_client.datasets_bucket,
                key=s3_key,
                body=content
            )

            images_count += 1
            total_bytes += len(content)

            # Track folder structure
            folder = os.path.dirname(member)
            if folder:
                if folder not in folder_structure:
                    folder_structure[folder] = 0
                folder_structure[folder] += 1

    return UploadResult(
        images_count=images_count,
        total_bytes=total_bytes,
        folder_structure=folder_structure
    )

async def parse_annotation_file(
    annotation_file: UploadFile
) -> Dict[str, Any]:
    """Parse annotation file (COCO/DICE format)."""
    content = await annotation_file.read()
    annotations_data = json.loads(content.decode('utf-8'))

    # Detect format and normalize to DICE
    if 'info' in annotations_data and 'licenses' in annotations_data:
        # COCO format
        return convert_coco_to_dice(annotations_data)
    else:
        # Assume DICE format
        return annotations_data
```

**File**: `backend/app/services/annotation_import_service.py`

```python
def import_annotations_to_db(
    labeler_db: Session,
    project_id: str,
    annotations_data: Dict[str, Any],
    current_user: User
) -> ImportResult:
    """Import annotations from DICE format to Labeler DB."""

    # Map image file_name to image_id
    image_mapping = {}
    for img in annotations_data.get('images', []):
        image_mapping[img['file_name']] = str(img['id'])

    imported_count = 0

    # Import annotations
    for ann_data in annotations_data.get('annotations', []):
        # Get image_id from mapping
        image_id = str(ann_data['image_id'])

        # Create annotation
        annotation = Annotation(
            project_id=project_id,
            image_id=image_id,
            class_id=str(ann_data['category_id']),
            annotation_type='bbox',
            geometry={
                'x': ann_data['bbox'][0],
                'y': ann_data['bbox'][1],
                'width': ann_data['bbox'][2],
                'height': ann_data['bbox'][3],
            },
            annotation_state='confirmed',
            created_by=current_user.id,
            confirmed_by=current_user.id,
            confirmed_at=datetime.utcnow()
        )

        labeler_db.add(annotation)
        imported_count += 1

    labeler_db.commit()

    return ImportResult(count=imported_count)
```

#### Frontend Implementation

**File**: `frontend/app/datasets/upload/page.tsx`

```tsx
export default function DatasetUploadPage() {
  const [step, setStep] = useState(1);
  const [datasetName, setDatasetName] = useState('');
  const [description, setDescription] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [annotationFile, setAnnotationFile] = useState<File | null>(null);
  const [hasAnnotations, setHasAnnotations] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('dataset_name', datasetName);
      formData.append('dataset_description', description);

      // Add images
      imageFiles.forEach((file) => {
        formData.append('files', file);
      });

      // Add annotations if provided
      if (hasAnnotations && annotationFile) {
        formData.append('annotation_file', annotationFile);
      }

      // Upload with progress tracking
      const response = await uploadDataset(formData, (progress) => {
        setUploadProgress(progress);
      });

      toast.success(`Dataset "${datasetName}" uploaded successfully!`);
      router.push(`/datasets/${response.dataset_id}`);

    } catch (error) {
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Upload New Dataset</h1>

      {/* Progress Steps */}
      <ProgressSteps currentStep={step}>
        <Step number={1} title="Basic Info" />
        <Step number={2} title="Upload Images" />
        <Step number={3} title="Annotations (Optional)" />
        <Step number={4} title="Review & Upload" />
      </ProgressSteps>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <section>
          <label>Dataset Name *</label>
          <input
            type="text"
            value={datasetName}
            onChange={(e) => setDatasetName(e.target.value)}
            placeholder="my-dataset"
          />

          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description of the dataset..."
            rows={4}
          />

          <button onClick={() => setStep(2)}>Next</button>
        </section>
      )}

      {/* Step 2: Upload Images */}
      {step === 2 && (
        <section>
          <FileDropzone
            accept="image/*,.zip"
            multiple
            onDrop={(files) => setImageFiles(files)}
          >
            <p>Drag & drop images or ZIP file here</p>
            <p className="text-sm">Supports: JPG, PNG, ZIP</p>
          </FileDropzone>

          {imageFiles.length > 0 && (
            <FileList files={imageFiles} onRemove={removeFile} />
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep(1)}>Back</button>
            <button onClick={() => setStep(3)} disabled={imageFiles.length === 0}>
              Next
            </button>
          </div>
        </section>
      )}

      {/* Step 3: Annotations */}
      {step === 3 && (
        <section>
          <Checkbox
            checked={hasAnnotations}
            onChange={(e) => setHasAnnotations(e.target.checked)}
          >
            This dataset has existing annotations
          </Checkbox>

          {hasAnnotations && (
            <FileDropzone
              accept=".json"
              single
              onDrop={(files) => setAnnotationFile(files[0])}
            >
              <p>Drop annotations.json file here</p>
              <p className="text-sm">Supports: COCO, DICE format</p>
            </FileDropzone>
          )}

          {annotationFile && (
            <p>✓ {annotationFile.name}</p>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep(2)}>Back</button>
            <button onClick={() => setStep(4)}>Next</button>
          </div>
        </section>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <section>
          <h2>Review Upload</h2>

          <dl>
            <dt>Dataset Name:</dt>
            <dd>{datasetName}</dd>

            <dt>Images:</dt>
            <dd>{imageFiles.length} files</dd>

            <dt>Annotations:</dt>
            <dd>{hasAnnotations && annotationFile ? 'Yes' : 'No'}</dd>
          </dl>

          {isUploading ? (
            <div>
              <ProgressBar value={uploadProgress} />
              <p>Uploading... {uploadProgress}%</p>
            </div>
          ) : (
            <div className="flex justify-between">
              <button onClick={() => setStep(3)}>Back</button>
              <button onClick={handleUpload}>Upload Dataset</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
```

---

### Phase 2.10.3: UI Enhancements (Week 4)

#### Dataset List Improvements
- Bulk selection
- Bulk delete
- Filter by status (labeled/unlabeled)
- Sort by size, date, name
- Search functionality

#### Dataset Detail Page
- Storage usage breakdown
- Version history
- Download options
- Share/export

---

### Phase 2.10.4: Safety Features (Week 5)

#### Soft Delete
```python
class Dataset(PlatformBase):
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[int] = None

@router.post("/{dataset_id}/restore")
async def restore_dataset(dataset_id: str):
    """Restore soft-deleted dataset."""
```

#### Audit Log
```python
class DatasetAuditLog(LabelerBase):
    dataset_id: str
    action: str  # 'created', 'uploaded', 'deleted', 'restored'
    performed_by: int
    details: JSONB
    timestamp: datetime
```

---

## 📊 Migration Strategy

### Phase 1: Parallel Operation (Month 1-2)
- Platform: Keep all features
- Labeler: Add upload/delete
- Users choose which to use

### Phase 2: Feature Parity (Month 3-4)
- Labeler: Match all Platform features
- Platform: Deprecation notice
- Migration guide

### Phase 3: Full Migration (Month 5-6)
- Platform: Redirect to Labeler
- Platform: Read-only mode
- Platform: Sunset

---

## 📁 File Changes Summary

### Backend (New)
```
backend/app/api/v1/endpoints/
├── datasets.py (ADD: delete, upload, deletion-impact)

backend/app/services/
├── dataset_upload_service.py (NEW)
├── dataset_delete_service.py (NEW)
├── annotation_import_service.py (NEW)

backend/app/schemas/
├── dataset.py (ADD: DeleteRequest, UploadRequest, responses)
```

### Frontend (New)
```
frontend/app/datasets/
├── upload/
│   └── page.tsx (NEW: Upload wizard)

frontend/components/datasets/
├── DeleteDatasetModal.tsx (NEW)
├── UploadProgress.tsx (NEW)
├── FileDropzone.tsx (NEW)
├── FolderTreePreview.tsx (NEW)

frontend/lib/api/
├── datasets.ts (ADD: delete, upload functions)
```

---

## ✅ Success Criteria

### Phase 2.10.1 (Deletion)
- ✅ User can delete dataset with confirmation
- ✅ All related data cascaded properly
- ✅ S3 files cleaned up
- ✅ Backup created before deletion
- ✅ Deletion summary displayed

### Phase 2.10.2 (Upload)
- ✅ User can upload images (single/multiple/ZIP)
- ✅ Folder structure preserved
- ✅ Annotations imported correctly
- ✅ Project auto-created
- ✅ Progress tracking working

### Phase 2.10.3 (UI)
- ✅ Upload wizard intuitive
- ✅ Bulk operations working
- ✅ Dataset management clear

### Phase 2.10.4 (Safety)
- ✅ Soft delete implemented
- ✅ Audit log tracking all actions
- ✅ Recovery mechanism tested

---

## 🚀 Implementation Timeline

| Week | Phase | Deliverables |
|------|-------|-------------|
| 1 | 2.10.1 | Dataset deletion backend + frontend |
| 2 | 2.10.2 | Dataset upload backend |
| 3 | 2.10.2 | Dataset upload frontend + testing |
| 4 | 2.10.3 | UI enhancements + bulk operations |
| 5 | 2.10.4 | Safety features + audit log |

---

## 📝 Notes

### Immediate Issue Resolution
- det-mvtec dataset corrupted (file_name: '1', '2', '3')
- Solution: Delete via Phase 2.10.1, re-upload via Phase 2.10.2
- Root cause: DICE export service uses image_id as file_name

### Future Considerations
- Multi-task upload (detection + segmentation)
- Collaborative uploads
- Dataset versioning
- Dataset cloning/forking

---

**Last Updated**: 2025-11-18
**Status**: 📋 Planning Complete, Ready for Implementation
