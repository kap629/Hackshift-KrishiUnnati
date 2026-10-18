import argparse
import json
from pathlib import Path

import numpy as np
import tensorflow as tf
from sklearn.metrics import classification_report, confusion_matrix

ROOT=Path(__file__).resolve().parent

def main():
    parser=argparse.ArgumentParser(description="Evaluate the trained model on the fixed PlantVillage validation split.")
    parser.add_argument("--data",default=str(ROOT/"data/plantvillage"));parser.add_argument("--batch-size",type=int,default=32);args=parser.parse_args()
    artifacts=ROOT/"artifacts";names=json.loads((artifacts/"class_names.json").read_text(encoding="utf-8"));model=tf.keras.models.load_model(artifacts/"krishiunnati_mobilenetv2.keras")
    data=tf.keras.utils.image_dataset_from_directory(args.data,validation_split=0.2,subset="validation",seed=42,image_size=(224,224),batch_size=args.batch_size,shuffle=False,class_names=names)
    labels=np.concatenate([y.numpy() for _,y in data]);preds=np.argmax(model.predict(data,verbose=1),axis=1)
    report=classification_report(labels,preds,target_names=names,output_dict=True,zero_division=0)
    print(classification_report(labels,preds,target_names=names,zero_division=0))
    reports=ROOT/"reports";reports.mkdir(exist_ok=True)
    (reports/"classification_report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    np.savetxt(reports/"confusion_matrix.csv",confusion_matrix(labels,preds),delimiter=",",fmt="%d")

if __name__=="__main__": main()
