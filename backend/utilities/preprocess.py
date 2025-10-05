import numpy as np
from tensorflow.keras.applications.efficientnet_v2 import preprocess_input
from PIL import Image

TARGET_SIZE = (224, 224)

def preprocess_image(pil_img):
    """
    Convert PIL image to model-ready array.
    Uses EfficientNetV2 preprocessing.
    Returns shape (1, H, W, C)
    """
    img = pil_img.convert("RGB").resize(TARGET_SIZE)
    arr = np.array(img)
    arr = preprocess_input(arr)  # EfficientNetV2 preprocessing
    return np.expand_dims(arr, axis=0)
