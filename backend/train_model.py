import os
import cv2
import yaml
import shutil
import xml.etree.ElementTree as ET
from sklearn.model_selection import train_test_split
from ultralytics import YOLO

# 📂 PATHS
IMAGES_DIR = "dataset/images"
ANN_DIR = "dataset/annotations"

WORK_DIR = "pothole_yolov8"
IMG_DIR = f"{WORK_DIR}/images"
LBL_DIR = f"{WORK_DIR}/labels"

# create folders
for split in ["train", "val"]:
    os.makedirs(f"{IMG_DIR}/{split}", exist_ok=True)
    os.makedirs(f"{LBL_DIR}/{split}", exist_ok=True)

# 🔄 XML → YOLO
def voc_to_yolo(xml_path, img_w, img_h):
    tree = ET.parse(xml_path)
    root = tree.getroot()
    labels = []

    for obj in root.findall("object"):
        bbox = obj.find("bndbox")

        xmin = float(bbox.find("xmin").text)
        ymin = float(bbox.find("ymin").text)
        xmax = float(bbox.find("xmax").text)
        ymax = float(bbox.find("ymax").text)

        x_c = ((xmin + xmax) / 2) / img_w
        y_c = ((ymin + ymax) / 2) / img_h
        w = (xmax - xmin) / img_w
        h = (ymax - ymin) / img_h

        labels.append(f"0 {x_c} {y_c} {w} {h}")

    return labels

# 📸 load images
all_images = [f for f in os.listdir(IMAGES_DIR) if f.endswith((".jpg", ".png", ".jpeg"))]

train_imgs, val_imgs = train_test_split(all_images, test_size=0.2)

def prepare_split(img_list, split):
    for img_name in img_list:
        img_path = os.path.join(IMAGES_DIR, img_name)
        base = os.path.splitext(img_name)[0]
        ann_path = os.path.join(ANN_DIR, base + ".xml")

        if not os.path.exists(ann_path):
            continue

        img = cv2.imread(img_path)
        if img is None:
            continue

        h, w, _ = img.shape
        labels = voc_to_yolo(ann_path, w, h)

        if not labels:
            continue

        shutil.copy(img_path, f"{IMG_DIR}/{split}/{img_name}")

        with open(f"{LBL_DIR}/{split}/{base}.txt", "w") as f:
            f.write("\n".join(labels))

prepare_split(train_imgs, "train")
prepare_split(val_imgs, "val")

# 🧾 data.yaml
data_yaml = {
    "path": WORK_DIR,
    "train": "images/train",
    "val": "images/val",
    "nc": 1,
    "names": ["pothole"]
}

with open(f"{WORK_DIR}/data.yaml", "w") as f:
    yaml.dump(data_yaml, f)

# 🚀 TRAIN
model = YOLO("yolov8n.pt")

model.train(
    data=f"{WORK_DIR}/data.yaml",
    epochs=50,
    imgsz=640,
    batch=8
)

print("✅ Training complete!")