# Trainer Converter Library Specifications - Phase 19.10

**Document Version**: 1.0
**Last Updated**: 2025-12-21
**Target Audience**: Trainer Team, ML Engineers
**Phase**: 19.10 - Trainer Conversion Library Design

---

## Overview

This document provides comprehensive specifications for implementing the **Trainer Converter Library** - a Python library that converts Vision AI Labeler's DICE format annotations (with text labels) into model-specific formats required by various VLM training frameworks.

**Purpose**: Enable seamless integration between Labeler's text label annotations and VLM training pipelines.

---

## Library Architecture

### Directory Structure

```
trainer/
├── converters/
│   ├── __init__.py
│   ├── base.py                    # Base converter interface
│   ├── dice_to_llava.py           # LLaVA converter
│   ├── dice_to_qwen.py            # Qwen-VL converter
│   ├── dice_to_yolo_world.py      # YOLO-World converter
│   ├── dice_to_vqa.py             # VQA v2 converter
│   ├── dice_to_visual_genome.py   # Visual Genome converter
│   ├── dice_to_instructblip.py    # InstructBLIP converter
│   └── utils.py                    # Shared utilities
├── datasets/
│   ├── __init__.py
│   ├── vlm_dataset.py              # Generic VLM dataset loader
│   └── dice_loader.py              # DICE format loader
├── validators/
│   ├── __init__.py
│   ├── format_validator.py         # Output format validation
│   └── schema_validator.py         # JSON schema validation
├── tests/
│   ├── fixtures/
│   │   ├── sample_dice.json        # Test DICE data
│   │   └── expected_outputs/       # Expected conversions
│   ├── test_llava_converter.py
│   ├── test_qwen_converter.py
│   └── ...
└── setup.py                         # Package setup
```

---

## Base Converter Interface

### Abstract Base Class

**File**: `trainer/converters/base.py`

```python
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class ConverterConfig:
    """Configuration for converter behavior."""
    max_conversations: Optional[int] = None  # Max turns per conversation
    include_image_level: bool = True          # Include image-level labels
    include_region_level: bool = True         # Include region-level labels
    language_filter: Optional[List[str]] = None  # Filter by language (e.g., ['en', 'ko'])
    shuffle_qa_pairs: bool = False            # Shuffle QA pairs for diversity
    validate_output: bool = True              # Validate output format


class DICEConverter(ABC):
    """
    Abstract base class for DICE format converters.

    All VLM-specific converters must inherit from this class and implement
    the required methods.
    """

    def __init__(self, config: Optional[ConverterConfig] = None):
        """
        Initialize converter with optional configuration.

        Args:
            config: Converter configuration
        """
        self.config = config or ConverterConfig()

    @abstractmethod
    def convert(self, dice_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Convert DICE format to target VLM format.

        Args:
            dice_data: DICE format annotation data (complete JSON)

        Returns:
            List of converted samples in target format

        Raises:
            ValueError: If input data is invalid
            ConversionError: If conversion fails
        """
        pass

    @abstractmethod
    def get_format_name(self) -> str:
        """Return the name of the target format (e.g., 'llava', 'qwen-vl')."""
        pass

    def validate_input(self, dice_data: Dict[str, Any]) -> bool:
        """
        Validate DICE format input.

        Args:
            dice_data: DICE format data

        Returns:
            True if valid, raises ValueError otherwise
        """
        required_keys = ['format_version', 'images']

        for key in required_keys:
            if key not in dice_data:
                raise ValueError(f"Missing required key in DICE data: {key}")

        return True

    def filter_by_language(self, labels: List[Dict], languages: List[str]) -> List[Dict]:
        """
        Filter labels by language.

        Args:
            labels: List of label dicts
            languages: List of language codes (e.g., ['en', 'ko'])

        Returns:
            Filtered labels
        """
        if not languages:
            return labels

        return [label for label in labels if label.get('language') in languages]

    def extract_image_level_labels(
        self,
        image_data: Dict[str, Any]
    ) -> tuple[List[Dict], List[Dict]]:
        """
        Extract image-level captions and VQA pairs from DICE image data.

        Args:
            image_data: Single image dict from DICE format

        Returns:
            Tuple of (captions, vqa_pairs)
        """
        captions = image_data.get('image_captions', [])
        vqa_pairs = image_data.get('vqa_pairs', [])

        # Apply language filter if configured
        if self.config.language_filter:
            captions = self.filter_by_language(captions, self.config.language_filter)
            vqa_pairs = self.filter_by_language(vqa_pairs, self.config.language_filter)

        return captions, vqa_pairs

    def extract_region_level_labels(
        self,
        image_data: Dict[str, Any]
    ) -> List[tuple[Dict, List[Dict]]]:
        """
        Extract region-level annotations with their text labels.

        Args:
            image_data: Single image dict from DICE format

        Returns:
            List of (annotation, text_labels) tuples
        """
        annotations = image_data.get('annotations', [])
        region_labels = []

        for annotation in annotations:
            text_labels = annotation.get('text_labels', [])

            # Apply language filter if configured
            if self.config.language_filter and text_labels:
                text_labels = self.filter_by_language(
                    text_labels,
                    self.config.language_filter
                )

            if text_labels:  # Only include if has text labels
                region_labels.append((annotation, text_labels))

        return region_labels


class ConversionError(Exception):
    """Exception raised when conversion fails."""
    pass
```

---

## Converter Implementations

### 1. LLaVA Converter

**File**: `trainer/converters/dice_to_llava.py`

```python
from typing import List, Dict, Any
import random
from .base import DICEConverter, ConverterConfig, ConversionError


class DICEToLLaVAConverter(DICEConverter):
    """
    Convert DICE format to LLaVA conversation format.

    LLaVA uses multi-turn conversations with <image> token.
    """

    def get_format_name(self) -> str:
        return "llava"

    def convert(self, dice_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Convert DICE to LLaVA format.

        Output format:
        {
            "id": "img001",
            "image": "path/to/img001.jpg",
            "conversations": [
                {"from": "human", "value": "Describe this image.\n<image>"},
                {"from": "gpt", "value": "A dog playing in the park"},
                {"from": "human", "value": "What is the dog doing?"},
                {"from": "gpt", "value": "Playing with a ball"}
            ]
        }
        """
        self.validate_input(dice_data)

        llava_samples = []

        for image_data in dice_data['images']:
            image_id = image_data['id']
            image_path = image_data['file_name']

            # Extract text labels
            captions, vqa_pairs = self.extract_image_level_labels(image_data)

            # Skip if no text labels
            if not captions and not vqa_pairs:
                continue

            # Build conversation
            conversations = []

            # Add caption turn (if available)
            if captions:
                caption_text = captions[0].get('text', '')
                conversations.append({
                    "from": "human",
                    "value": "Describe this image.\n<image>"
                })
                conversations.append({
                    "from": "gpt",
                    "value": caption_text
                })

            # Add VQA turns
            if self.config.shuffle_qa_pairs:
                random.shuffle(vqa_pairs)

            for qa in vqa_pairs:
                question = qa.get('question', '')
                answer = qa.get('answer', '')

                conversations.append({
                    "from": "human",
                    "value": question
                })
                conversations.append({
                    "from": "gpt",
                    "value": answer
                })

            # Enforce max conversations limit
            if self.config.max_conversations:
                max_turns = self.config.max_conversations * 2  # 2 messages per turn
                conversations = conversations[:max_turns]

            # Create LLaVA sample
            llava_sample = {
                "id": image_id,
                "image": image_path,
                "conversations": conversations
            }

            llava_samples.append(llava_sample)

        return llava_samples
```

---

### 2. Qwen-VL Converter

**File**: `trainer/converters/dice_to_qwen.py`

```python
from typing import List, Dict, Any
from .base import DICEConverter


class DICEToQwenConverter(DICEConverter):
    """
    Convert DICE format to Qwen-VL format.

    Qwen-VL uses special <img> tokens in conversations.
    """

    def get_format_name(self) -> str:
        return "qwen-vl"

    def convert(self, dice_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Convert DICE to Qwen-VL format.

        Output format:
        {
            "id": "img001",
            "conversations": [
                {
                    "from": "user",
                    "value": "<img>path/to/img001.jpg</img>Describe this image."
                },
                {
                    "from": "assistant",
                    "value": "A dog playing in the park"
                }
            ]
        }
        """
        self.validate_input(dice_data)

        qwen_samples = []

        for image_data in dice_data['images']:
            image_id = image_data['id']
            image_path = image_data['file_name']

            # Extract text labels
            captions, vqa_pairs = self.extract_image_level_labels(image_data)

            if not captions and not vqa_pairs:
                continue

            # Build Qwen conversation
            conversations = []

            # Add caption turn
            if captions:
                caption_text = captions[0].get('text', '')
                conversations.append({
                    "from": "user",
                    "value": f"<img>{image_path}</img>Describe this image."
                })
                conversations.append({
                    "from": "assistant",
                    "value": caption_text
                })

            # Add VQA turns
            for qa in vqa_pairs:
                question = qa.get('question', '')
                answer = qa.get('answer', '')

                conversations.append({
                    "from": "user",
                    "value": question
                })
                conversations.append({
                    "from": "assistant",
                    "value": answer
                })

            # Create Qwen sample
            qwen_sample = {
                "id": image_id,
                "conversations": conversations
            }

            qwen_samples.append(qwen_sample)

        return qwen_samples
```

---

### 3. YOLO-World Converter

**File**: `trainer/converters/dice_to_yolo_world.py`

```python
from typing import List, Dict, Any, Tuple
from .base import DICEConverter


class DICEToYOLOWorldConverter(DICEConverter):
    """
    Convert DICE format to YOLO-World format.

    YOLO-World requires text prompts in label files.
    Challenge: Standard YOLO format doesn't support text.
    Solution: Extend YOLO format with text after bbox coordinates.
    """

    def get_format_name(self) -> str:
        return "yolo-world"

    def convert(self, dice_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert DICE to YOLO-World format.

        Returns:
            Dict with:
            - 'labels': Dict[image_id, label_file_content]
            - 'captions': Dict[image_id, captions_json]
            - 'classes': List of class names
        """
        self.validate_input(dice_data)

        labels_dict = {}
        captions_dict = {}
        classes_set = set()

        for image_data in dice_data['images']:
            image_id = image_data['id']
            annotations = image_data.get('annotations', [])

            # Extract image dimensions
            img_width = image_data.get('width', 1)
            img_height = image_data.get('height', 1)

            # Build YOLO label lines
            label_lines = []

            for annotation in annotations:
                # Get class
                class_name = annotation.get('class_name', '')
                classes_set.add(class_name)

                # Get bbox
                geometry = annotation.get('geometry', {})
                if geometry.get('type') != 'bbox':
                    continue  # YOLO-World only supports bbox

                bbox = geometry.get('bbox', [])
                if len(bbox) != 4:
                    continue

                # Convert to YOLO format (normalized x_center, y_center, width, height)
                x_min, y_min, x_max, y_max = bbox
                x_center = (x_min + x_max) / 2 / img_width
                y_center = (y_min + y_max) / 2 / img_height
                width = (x_max - x_min) / img_width
                height = (y_max - y_min) / img_height

                # Get text label (if available)
                text_labels = annotation.get('text_labels', [])
                text_prompt = ""
                if text_labels:
                    text_prompt = text_labels[0].get('text', '')

                # Class ID (index in classes list)
                class_id = list(classes_set).index(class_name)

                # YOLO-World format: class_id x_center y_center width height [text_prompt]
                if text_prompt:
                    line = f"{class_id} {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f} {text_prompt}"
                else:
                    line = f"{class_id} {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f}"

                label_lines.append(line)

            # Store label file content
            if label_lines:
                labels_dict[image_id] = "\n".join(label_lines)

            # Extract image-level captions
            captions, _ = self.extract_image_level_labels(image_data)
            if captions:
                captions_dict[image_id] = [
                    {"text": cap.get('text', ''), "language": cap.get('language', 'en')}
                    for cap in captions
                ]

        return {
            'labels': labels_dict,
            'captions': captions_dict,
            'classes': sorted(list(classes_set))
        }
```

---

### 4. VQA v2 Converter

**File**: `trainer/converters/dice_to_vqa.py`

```python
from typing import List, Dict, Any
from .base import DICEConverter


class DICEToVQAConverter(DICEConverter):
    """
    Convert DICE format to VQA v2 format.

    VQA v2 requires answers in specific array format with confidence.
    """

    def get_format_name(self) -> str:
        return "vqa-v2"

    def convert(self, dice_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Convert DICE to VQA v2 format.

        Output format:
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
        """
        self.validate_input(dice_data)

        vqa_samples = []
        question_id = 1

        for image_data in dice_data['images']:
            image_id = image_data['id']

            # Extract VQA pairs
            _, vqa_pairs = self.extract_image_level_labels(image_data)

            for qa in vqa_pairs:
                question = qa.get('question', '')
                answer = qa.get('answer', '')

                # Create VQA v2 sample
                vqa_sample = {
                    "question_id": question_id,
                    "image_id": image_id,
                    "question": question,
                    "answers": [
                        {
                            "answer": answer,
                            "answer_confidence": "yes",
                            "answer_id": 1
                        }
                    ]
                }

                vqa_samples.append(vqa_sample)
                question_id += 1

        return vqa_samples
```

---

## Validation Framework

### Format Validator

**File**: `trainer/validators/format_validator.py`

```python
from typing import Dict, Any, List


def validate_llava_format(sample: Dict[str, Any]) -> bool:
    """Validate LLaVA conversation format."""
    required_keys = ['id', 'image', 'conversations']

    for key in required_keys:
        if key not in sample:
            raise ValueError(f"Missing required key: {key}")

    # Validate conversations
    conversations = sample['conversations']
    if not isinstance(conversations, list) or len(conversations) < 2:
        raise ValueError("Conversations must have at least one turn (2 messages)")

    for turn in conversations:
        if 'from' not in turn or 'value' not in turn:
            raise ValueError("Conversation turn missing 'from' or 'value'")

        if turn['from'] not in ['human', 'gpt']:
            raise ValueError(f"Invalid 'from' value: {turn['from']}")

    return True


def validate_qwen_format(sample: Dict[str, Any]) -> bool:
    """Validate Qwen-VL format."""
    if 'id' not in sample or 'conversations' not in sample:
        raise ValueError("Missing required keys")

    for turn in sample['conversations']:
        if 'from' not in turn or 'value' not in turn:
            raise ValueError("Conversation turn missing keys")

        if turn['from'] not in ['user', 'assistant']:
            raise ValueError(f"Invalid 'from' value: {turn['from']}")

    return True


def validate_yolo_world_format(data: Dict[str, Any]) -> bool:
    """Validate YOLO-World format."""
    required_keys = ['labels', 'classes']

    for key in required_keys:
        if key not in data:
            raise ValueError(f"Missing required key: {key}")

    # Validate label format
    for image_id, label_content in data['labels'].items():
        lines = label_content.strip().split('\n')
        for line in lines:
            parts = line.split(maxsplit=5)  # class_id, bbox (4), text
            if len(parts) < 5:
                raise ValueError(f"Invalid YOLO label line: {line}")

            # Validate bbox values are floats in [0, 1]
            try:
                bbox = [float(x) for x in parts[1:5]]
                if not all(0 <= val <= 1 for val in bbox):
                    raise ValueError(f"Bbox values out of range: {bbox}")
            except ValueError:
                raise ValueError(f"Invalid bbox values: {parts[1:5]}")

    return True


def validate_vqa_format(sample: Dict[str, Any]) -> bool:
    """Validate VQA v2 format."""
    required_keys = ['question_id', 'image_id', 'question', 'answers']

    for key in required_keys:
        if key not in sample:
            raise ValueError(f"Missing required key: {key}")

    # Validate answers
    answers = sample['answers']
    if not isinstance(answers, list) or len(answers) == 0:
        raise ValueError("Answers must be non-empty list")

    for answer in answers:
        if 'answer' not in answer:
            raise ValueError("Answer missing 'answer' field")

    return True
```

---

## Testing Framework

### Test Structure

```python
# tests/test_llava_converter.py
import json
import pytest
from converters.dice_to_llava import DICEToLLaVAConverter
from validators.format_validator import validate_llava_format


@pytest.fixture
def sample_dice_data():
    """Load sample DICE data."""
    with open('tests/fixtures/sample_dice.json') as f:
        return json.load(f)


def test_llava_conversion_basic(sample_dice_data):
    """Test basic DICE to LLaVA conversion."""
    converter = DICEToLLaVAConverter()
    llava_data = converter.convert(sample_dice_data)

    # Verify output
    assert len(llava_data) > 0
    assert isinstance(llava_data, list)

    # Validate each sample
    for sample in llava_data:
        validate_llava_format(sample)


def test_llava_conversion_with_config():
    """Test conversion with custom config."""
    from converters.base import ConverterConfig

    config = ConverterConfig(
        max_conversations=2,
        language_filter=['en'],
        shuffle_qa_pairs=True
    )

    converter = DICEToLLaVAConverter(config=config)
    # ... test with config


def test_llava_conversation_structure(sample_dice_data):
    """Test conversation structure is correct."""
    converter = DICEToLLaVAConverter()
    llava_data = converter.convert(sample_dice_data)

    sample = llava_data[0]

    # Check first turn is human with <image>
    assert sample['conversations'][0]['from'] == 'human'
    assert '<image>' in sample['conversations'][0]['value']

    # Check alternating human/gpt
    for i, turn in enumerate(sample['conversations']):
        expected_from = 'human' if i % 2 == 0 else 'gpt'
        assert turn['from'] == expected_from
```

---

## Usage Examples

### Basic Usage

```python
from converters.dice_to_llava import DICEToLLaVAConverter
import json

# Load DICE data
with open('annotations_dice.json') as f:
    dice_data = json.load(f)

# Convert to LLaVA
converter = DICEToLLaVAConverter()
llava_data = converter.convert(dice_data)

# Save output
with open('llava_training_data.json', 'w') as f:
    json.dump(llava_data, f, indent=2, ensure_ascii=False)

print(f"Converted {len(llava_data)} samples to LLaVA format")
```

### With Configuration

```python
from converters.dice_to_llava import DICEToLLaVAConverter
from converters.base import ConverterConfig

# Configure converter
config = ConverterConfig(
    max_conversations=3,  # Max 3 turns per conversation
    language_filter=['en', 'ko'],  # Only English and Korean
    shuffle_qa_pairs=True,  # Randomize QA order
    validate_output=True  # Validate output format
)

converter = DICEToLLaVAConverter(config=config)
llava_data = converter.convert(dice_data)
```

### Batch Conversion

```python
from converters import (
    DICEToLLaVAConverter,
    DICEToQwenConverter,
    DICEToYOLOWorldConverter
)

converters = {
    'llava': DICEToLLaVAConverter(),
    'qwen': DICEToQwenConverter(),
    'yolo-world': DICEToYOLOWorldConverter()
}

for format_name, converter in converters.items():
    output = converter.convert(dice_data)

    with open(f'{format_name}_data.json', 'w') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"✓ Converted to {format_name}")
```

---

## Implementation Guidelines

### Code Quality Standards

1. **Type Hints**: All functions must have type hints
2. **Docstrings**: Google-style docstrings for all public methods
3. **Error Handling**: Specific exceptions with clear messages
4. **Validation**: Always validate input and optionally validate output
5. **Testing**: 80%+ code coverage

### Performance Considerations

1. **Memory Efficiency**: Process large datasets in chunks if needed
2. **Parallel Processing**: Support multi-threaded conversion for large datasets
3. **Caching**: Cache intermediate results for repeated conversions

### Extensibility

1. **Plugin System**: Allow custom converters via plugin registration
2. **Hooks**: Pre/post-conversion hooks for customization
3. **Filters**: Composable filter system for data preprocessing

---

## Deployment & Packaging

### PyPI Package Structure

```python
# setup.py
from setuptools import setup, find_packages

setup(
    name='vlm-labeler-converters',
    version='1.0.0',
    description='Convert Vision AI Labeler annotations to VLM training formats',
    packages=find_packages(),
    install_requires=[
        'pydantic>=2.0',
        'jsonschema>=4.0',
    ],
    extras_require={
        'dev': ['pytest', 'pytest-cov', 'black', 'mypy'],
    },
    python_requires='>=3.8',
)
```

### Installation

```bash
pip install vlm-labeler-converters

# Development install
git clone https://github.com/your-org/vlm-labeler-converters
cd vlm-labeler-converters
pip install -e ".[dev]"
```

### CLI Tool

```bash
# Convert DICE to LLaVA
vlm-convert dice annotations.json --format llava --output llava_data.json

# Convert with config
vlm-convert dice annotations.json --format qwen --max-conversations 3 --language en ko

# Batch convert
vlm-convert dice annotations.json --formats llava,qwen,yolo-world --output-dir ./converted/
```

---

## Future Enhancements

1. **Streaming Conversion**: Support for very large datasets
2. **Format Auto-detection**: Automatically detect optimal format for target model
3. **Quality Metrics**: Calculate conversion quality scores
4. **Visual Inspection Tools**: GUI tool to inspect conversion results
5. **Cloud Integration**: Direct download from S3, upload to HuggingFace Hub

---

## References

- [LLaVA GitHub](https://github.com/haotian-liu/LLaVA)
- [Qwen-VL GitHub](https://github.com/QwenLM/Qwen-VL)
- [YOLO-World Paper](https://arxiv.org/abs/2401.17270)
- [VQA v2 Dataset](https://visualqa.org/)

---

**Document Maintenance**: Update this document when:
- New converters are implemented
- API interfaces change
- Testing requirements evolve
- User feedback identifies improvements
