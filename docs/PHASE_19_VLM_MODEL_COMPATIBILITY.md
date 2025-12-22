# VLM Model Compatibility Guide - Phase 19

**Document Version**: 1.0
**Last Updated**: 2025-12-21
**Phase**: 19.9 - Export Format Compatibility Verification

---

## Overview

This document provides comprehensive compatibility information for using Vision AI Labeler's text label annotations with popular Vision-Language Models (VLMs). It covers:

- **Supported Models**: Which VLM frameworks can use our export formats
- **Format Compatibility**: Direct vs. conversion-required formats
- **Trainer Conversion Requirements**: What conversions are needed for each model
- **Example Code**: Sample conversion scripts

---

## Export Format Summary

Vision AI Labeler exports text labels in **three primary formats**:

| Format | Description | Use Case |
|--------|-------------|----------|
| **DICE** | Native format with full metadata | Primary format, all features supported |
| **COCO** | COCO Captions + extensions | Standard CV tools, COCO-based models |
| **YOLO** | YOLO + separate text files | YOLO-based models |

All formats include:
- **Image-level labels**: Captions, descriptions, VQA
- **Region-level labels**: Bbox/polygon text descriptions

---

## VLM Model Compatibility Matrix

### Legend

- ✅ **Direct**: No conversion needed, use format as-is
- ⚠️ **Trainer Conversion**: Requires conversion script (provided in trainer)
- ❌ **Not Supported**: Format incompatible with this model

---

### Image Captioning Models

| Model | DICE | COCO | YOLO | Conversion Required | Notes |
|-------|------|------|------|-------------------|-------|
| **BLIP** | ✅ | ✅ | ⚠️ | Extract `image_captions` → simple JSON | COCO captions format preferred |
| **BLIP-2** | ✅ | ✅ | ⚠️ | Extract `image_captions` → simple JSON | Same as BLIP |
| **ClipCap** | ✅ | ✅ | ❌ | Convert to TSV format | Needs custom trainer script |
| **COCO Captions** | ✅ | ✅ | ❌ | None (COCO format direct) | Standard COCO captions API |
| **GIT (Generative Image-to-text)** | ✅ | ✅ | ⚠️ | Extract captions → HuggingFace dataset | Supports COCO format |

**Recommendation**: Use **COCO format** for captioning models when possible (standard API support).

---

### Visual Question Answering (VQA) Models

| Model | DICE | COCO | YOLO | Conversion Required | Notes |
|-------|------|------|------|-------------------|-------|
| **VQA v2** | ✅ | ⚠️ | ❌ | Convert QA pairs → add `answers[]` array | Standard VQA v2 format |
| **LLaVA 1.5** | ✅ | ⚠️ | ❌ | Convert to conversation format | Multi-turn dialogue format |
| **Qwen-VL** | ✅ | ⚠️ | ❌ | Convert to Qwen conversation format | Custom format with `<img>` tokens |
| **InstructBLIP** | ✅ | ⚠️ | ❌ | Convert to instruction format | Instruction-response pairs |
| **mPLUG-Owl** | ✅ | ⚠️ | ❌ | Convert to conversation format | Similar to LLaVA |

**Recommendation**: Use **DICE format** as source, convert to model-specific format in trainer.

---

### Grounding & Detection Models

| Model | DICE | COCO | YOLO | Conversion Required | Notes |
|-------|------|------|------|-------------------|-------|
| **Grounding DINO** | ✅ | ✅ | ⚠️ | None (COCO + text queries) | Uses region descriptions directly |
| **OWL-ViT** | ✅ | ✅ | ⚠️ | Extract region descriptions → text queries | Open-vocabulary detection |
| **YOLO-World** | ✅ | ❌ | ⚠️ | Modify YOLO labels to include text | **Custom YOLO format** |
| **GLIPv2** | ✅ | ✅ | ❌ | Use COCO + region descriptions | Phrase grounding |

**Recommendation**:
- **Grounding DINO/OWL-ViT**: Use **COCO format** (standard)
- **YOLO-World**: Use **DICE format** → custom YOLO conversion

---

### Dense Captioning & Region Description Models

| Model | DICE | COCO | YOLO | Conversion Required | Notes |
|-------|------|------|------|-------------------|-------|
| **Visual Genome** | ✅ | ✅ | ❌ | Map to VG region format | Standard Visual Genome format |
| **RefCOCO** | ✅ | ✅ | ❌ | Extract referring expressions | Region descriptions → sentences |
| **KOSMOS-2** | ✅ | ⚠️ | ❌ | Convert to markdown-like format | Custom interleaved format |
| **Flamingo** | ✅ | ⚠️ | ❌ | Convert to interleaved format | Image-text interleaving |

**Recommendation**: Use **DICE format** or **COCO format** with `region_descriptions[]` extension.

---

## Detailed Conversion Requirements

### 1. LLaVA Conversation Format

**Input (DICE)**:
```json
{
  "image_id": "img001.jpg",
  "image_captions": ["A dog playing in the park"],
  "vqa_pairs": [
    {"question": "What is the dog doing?", "answer": "Playing with a ball"}
  ]
}
```

**Output (LLaVA)**:
```json
{
  "id": "img001",
  "image": "img001.jpg",
  "conversations": [
    {"from": "human", "value": "Describe this image.\n<image>"},
    {"from": "gpt", "value": "A dog playing in the park"},
    {"from": "human", "value": "What is the dog doing?"},
    {"from": "gpt", "value": "Playing with a ball"}
  ]
}
```

**Trainer Script**: `trainer/converters/dice_to_llava.py`

---

### 2. Qwen-VL Format

**Input (DICE)**:
```json
{
  "image_id": "img001.jpg",
  "image_captions": ["A dog playing in the park"]
}
```

**Output (Qwen-VL)**:
```json
{
  "id": "img001",
  "conversations": [
    {
      "from": "user",
      "value": "<img>img001.jpg</img>Describe this image."
    },
    {
      "from": "assistant",
      "value": "A dog playing in the park"
    }
  ]
}
```

**Trainer Script**: `trainer/converters/dice_to_qwen.py`

---

### 3. YOLO-World Modified Labels

**Input (DICE)**:
```json
{
  "annotations": [
    {
      "bbox": [100, 100, 200, 200],
      "category_id": 1,
      "class_name": "dog",
      "text_labels": [{"text": "golden retriever dog"}]
    }
  ]
}
```

**Output (YOLO-World)**:
```
# img001.txt
1 0.5 0.5 0.3 0.3 golden retriever dog
```

**Challenge**: YOLO format doesn't natively support text in labels.

**Solution**:
1. Modify YOLO dataset loader to parse text after bbox coordinates
2. Or use separate JSON file mapping (captions/img001.json)

**Trainer Script**: `trainer/converters/dice_to_yolo_world.py`

---

### 4. VQA v2 Format

**Input (DICE)**:
```json
{
  "vqa_pairs": [
    {"question": "What color is the dog?", "answer": "brown"}
  ]
}
```

**Output (VQA v2)**:
```json
{
  "question_id": 1,
  "image_id": "img001",
  "question": "What color is the dog?",
  "answers": [
    {
      "answer": "brown",
      "answer_confidence": "yes",
      "answer_id": 1
    }
  ]
}
```

**Trainer Script**: `trainer/converters/dice_to_vqa.py`

---

## Trainer Conversion Library Architecture

### Recommended Structure

```
trainer/
├── converters/
│   ├── __init__.py
│   ├── base.py                    # Base converter class
│   ├── dice_to_llava.py           # LLaVA converter
│   ├── dice_to_qwen.py            # Qwen-VL converter
│   ├── dice_to_yolo_world.py     # YOLO-World converter
│   ├── dice_to_vqa.py             # VQA v2 converter
│   ├── dice_to_visual_genome.py  # Visual Genome converter
│   └── dice_to_instructblip.py   # InstructBLIP converter
├── datasets/
│   └── vlm_dataset.py             # Generic VLM dataset loader
└── utils/
    └── format_validators.py       # Format validation utilities
```

### Base Converter Interface

```python
# trainer/converters/base.py
from abc import ABC, abstractmethod
from typing import List, Dict, Any

class DICEConverter(ABC):
    """Base class for DICE format converters."""

    @abstractmethod
    def convert(self, dice_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Convert DICE format to target format.

        Args:
            dice_data: DICE format annotation data

        Returns:
            List of converted samples
        """
        pass

    def validate_input(self, dice_data: Dict[str, Any]) -> bool:
        """Validate DICE format input."""
        required_keys = ['format_version', 'images']
        return all(key in dice_data for key in required_keys)
```

---

## HuggingFace Datasets Integration

### Using DICE Format with HuggingFace

DICE format can be directly loaded into HuggingFace `datasets`:

```python
from datasets import load_dataset

# Option 1: Load from JSON
dataset = load_dataset('json', data_files='annotations_dice.json')

# Option 2: Custom dataset script
dataset = load_dataset('vlm_labeler_dice.py', data_dir='path/to/dataset')

# Access text labels
for example in dataset['train']:
    image_id = example['id']
    captions = example.get('image_captions', [])
    vqa_pairs = example.get('vqa_pairs', [])

    # Process text labels
    for caption in captions:
        print(f"Caption: {caption['text']}")
```

### Custom Dataset Loader Example

```python
# vlm_labeler_dice.py
import json
import datasets

class VLMLabelerDICE(datasets.GeneratorBasedBuilder):
    """DICE format dataset for VLM training."""

    def _generate_examples(self, filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        for idx, image_data in enumerate(data['images']):
            yield idx, {
                'image_id': image_data['id'],
                'image_path': image_data['file_name'],
                'captions': image_data.get('image_captions', []),
                'vqa_pairs': image_data.get('vqa_pairs', []),
                'annotations': image_data.get('annotations', []),
            }
```

---

## Storage Strategy & Download Flow

### Labeler → Trainer Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. LABELER: Publish Version                                 │
├─────────────────────────────────────────────────────────────┤
│ User publishes v1.0 → Creates immutable snapshot            │
│ ↓                                                            │
│ Internal S3: projects/{project_id}/annotations/             │
│              text_labels/v1.0/text_labels.json (history)    │
│ ↓                                                            │
│ External S3: datasets/{dataset_id}/annotations/             │
│              text_labels.json (latest, overwrite)           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. TRAINER: Download & Convert                              │
├─────────────────────────────────────────────────────────────┤
│ Download from External S3:                                  │
│  - annotations/annotations_detection.json (DICE)            │
│  - annotations/text_labels.json (text labels)               │
│ ↓                                                            │
│ Load DICE format → Merge annotations + text labels          │
│ ↓                                                            │
│ Convert to model-specific format:                           │
│  - LLaVA: dice_to_llava.py → conversations.json             │
│  - Qwen-VL: dice_to_qwen.py → qwen_format.json              │
│  - YOLO-World: dice_to_yolo_world.py → modified labels.txt  │
│ ↓                                                            │
│ Train model with converted format                           │
└─────────────────────────────────────────────────────────────┘
```

### Trainer Download Script Example

```python
# trainer/download_dataset.py
import boto3
import json
from converters.dice_to_llava import DICEToLLaVAConverter

def download_and_convert(dataset_id, model_type='llava'):
    """Download dataset from External S3 and convert to model format."""

    s3 = boto3.client('s3')
    bucket = 'external-storage'

    # 1. Download annotations (DICE format)
    annotations_key = f'datasets/{dataset_id}/annotations/annotations_detection.json'
    annotations = json.loads(
        s3.get_object(Bucket=bucket, Key=annotations_key)['Body'].read()
    )

    # 2. Download text labels
    text_labels_key = f'datasets/{dataset_id}/annotations/text_labels.json'
    text_labels = json.loads(
        s3.get_object(Bucket=bucket, Key=text_labels_key)['Body'].read()
    )

    # 3. Merge text labels into DICE annotations
    merged_data = merge_text_labels(annotations, text_labels)

    # 4. Convert to model-specific format
    if model_type == 'llava':
        converter = DICEToLLaVAConverter()
        training_data = converter.convert(merged_data)
    elif model_type == 'qwen':
        converter = DICEToQwenConverter()
        training_data = converter.convert(merged_data)
    # ... other models

    return training_data
```

---

## Testing & Validation

### Format Validation

Each converter should include validation:

```python
def validate_llava_format(data):
    """Validate LLaVA conversation format."""
    assert 'id' in data
    assert 'image' in data
    assert 'conversations' in data
    assert len(data['conversations']) >= 2  # At least one turn

    for turn in data['conversations']:
        assert 'from' in turn  # 'human' or 'gpt'
        assert 'value' in turn  # Conversation text
        assert turn['from'] in ['human', 'gpt']
```

### Conversion Test Script

```python
# tests/test_converters.py
import json
from converters.dice_to_llava import DICEToLLaVAConverter

def test_dice_to_llava_conversion():
    # Load sample DICE data
    with open('tests/fixtures/sample_dice.json') as f:
        dice_data = json.load(f)

    # Convert
    converter = DICEToLLaVAConverter()
    llava_data = converter.convert(dice_data)

    # Validate
    assert len(llava_data) > 0
    for sample in llava_data:
        validate_llava_format(sample)

    print("✓ DICE → LLaVA conversion successful")
```

---

## Compatibility Summary Table

| Model Category | Recommended Format | Conversion Complexity | Time Estimate |
|----------------|-------------------|----------------------|---------------|
| **Image Captioning** | COCO | Low | 1-2 days |
| **VQA Models** | DICE | Medium | 2-3 days |
| **Grounding Models** | COCO | Low | 1-2 days |
| **YOLO-World** | DICE | High | 3-5 days |
| **Dense Captioning** | DICE or COCO | Medium | 2-3 days |

---

## Common Issues & Solutions

### Issue 1: YOLO-World Text in Labels

**Problem**: YOLO format doesn't support text in label files natively.

**Solution Options**:
1. **Modify YOLO loader**: Parse text after bbox coordinates
   ```python
   # Modified YOLO loader
   def parse_yolo_line(line):
       parts = line.strip().split(maxsplit=5)  # Split first 5 fields
       class_id = int(parts[0])
       bbox = [float(x) for x in parts[1:5]]
       text = parts[5] if len(parts) > 5 else ""  # Optional text
       return class_id, bbox, text
   ```

2. **Use separate JSON**: Keep YOLO labels standard, add `captions/` directory
   ```
   labels/img001.txt  # Standard YOLO bbox
   captions/img001.json  # {"region_descriptions": [...]}
   ```

### Issue 2: LLaVA Multi-turn Conversations

**Problem**: DICE stores individual QA pairs, LLaVA needs conversations.

**Solution**: Group QA pairs by image, create multi-turn dialogue:
```python
def create_conversation(captions, vqa_pairs):
    conversation = []

    # Add caption turn
    if captions:
        conversation.append({
            "from": "human",
            "value": "Describe this image.\n<image>"
        })
        conversation.append({
            "from": "gpt",
            "value": captions[0]['text']
        })

    # Add VQA turns
    for qa in vqa_pairs:
        conversation.append({
            "from": "human",
            "value": qa['question']
        })
        conversation.append({
            "from": "gpt",
            "value": qa['answer']
        })

    return conversation
```

---

## Future Enhancements

### Planned Features

1. **Auto-conversion on export**: Option to export directly in model-specific format
2. **HuggingFace Hub integration**: Publish datasets directly to HF Hub
3. **Pre-built converter library**: Pip-installable conversion package
4. **Format validation tools**: CLI tool to validate conversions

---

## References

- [COCO Captions Format](http://cocodataset.org/#format-data)
- [Visual Genome Dataset](https://visualgenome.org/api/v0/api_home.html)
- [LLaVA Dataset Format](https://github.com/haotian-liu/LLaVA#visual-instruction-tuning)
- [Qwen-VL Documentation](https://github.com/QwenLM/Qwen-VL)
- [YOLO-World Paper](https://arxiv.org/abs/2401.17270)
- [HuggingFace Datasets](https://huggingface.co/docs/datasets)

---

**Document Maintenance**: This document should be updated when:
- New VLM models are tested
- Conversion scripts are implemented
- Format specifications change
- User feedback identifies compatibility issues
