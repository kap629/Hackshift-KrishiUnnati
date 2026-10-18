import argparse
import json
from pathlib import Path

import tensorflow as tf

ROOT = Path(__file__).resolve().parent

def main():
    parser = argparse.ArgumentParser(description="Train MobileNetV2 on a folder-per-class PlantVillage dataset.")
    parser.add_argument("--data", default=str(ROOT / "data/plantvillage"))
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch-size", type=int, default=32)
    args = parser.parse_args()
    train = tf.keras.utils.image_dataset_from_directory(args.data, validation_split=0.2, subset="training", seed=42, image_size=(224,224), batch_size=args.batch_size)
    valid = tf.keras.utils.image_dataset_from_directory(args.data, validation_split=0.2, subset="validation", seed=42, image_size=(224,224), batch_size=args.batch_size)
    names = train.class_names
    autotune=tf.data.AUTOTUNE
    train=train.cache().shuffle(1000).prefetch(autotune)
    valid=valid.cache().prefetch(autotune)
    augment=tf.keras.Sequential([tf.keras.layers.RandomFlip("horizontal"),tf.keras.layers.RandomRotation(0.08),tf.keras.layers.RandomZoom(0.1)])
    base=tf.keras.applications.MobileNetV2(input_shape=(224,224,3),include_top=False,weights="imagenet")
    base.trainable=False
    inputs=tf.keras.Input(shape=(224,224,3))
    x=augment(inputs)
    x=tf.keras.applications.mobilenet_v2.preprocess_input(x)
    x=base(x,training=False)
    x=tf.keras.layers.GlobalAveragePooling2D()(x)
    x=tf.keras.layers.Dropout(0.25)(x)
    outputs=tf.keras.layers.Dense(len(names),activation="softmax")(x)
    model=tf.keras.Model(inputs,outputs)
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-3),loss="sparse_categorical_crossentropy",metrics=["accuracy"])
    artifacts=ROOT/"artifacts";artifacts.mkdir(exist_ok=True)
    model_path=artifacts/"krishiunnati_mobilenetv2.keras"
    callbacks=[tf.keras.callbacks.ModelCheckpoint(model_path,monitor="val_accuracy",save_best_only=True),tf.keras.callbacks.EarlyStopping(monitor="val_loss",patience=3,restore_best_weights=True)]
    model.fit(train,validation_data=valid,epochs=args.epochs,callbacks=callbacks)
    base.trainable=True
    for layer in base.layers[:-30]: layer.trainable=False
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-5),loss="sparse_categorical_crossentropy",metrics=["accuracy"])
    model.fit(train,validation_data=valid,epochs=max(2,args.epochs//2),callbacks=callbacks)
    model.save(model_path)
    (artifacts/"class_names.json").write_text(json.dumps(names,indent=2),encoding="utf-8")
    print(f"Saved trained model and labels to {artifacts}")

if __name__=="__main__": main()
