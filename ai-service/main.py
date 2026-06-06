from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import random

app = FastAPI(title="AgroBeta - AI Signature Validation Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "AI Signature Validation Service is running."}

@app.post("/validar-firma")
async def validar_firma(firma_contrato: UploadFile = File(...), firma_dni: UploadFile = File(...)):
    """
    Simulación del servicio de IA (Siamese Network / OpenCV).
    Compara dos firmas y devuelve un score de similitud.
    """
    # En un entorno real, aquí se preprocesan las imágenes con OpenCV
    # y se pasan por un modelo biométrico.
    
    # Para el MVP, simularemos un score alto (>= 90%) la mayor parte del tiempo
    # simulando que la firma es válida.
    score_similitud = round(random.uniform(0.85, 0.99), 4)
    aprobado = score_similitud >= 0.90

    return {
        "success": True,
        "score_similitud": score_similitud,
        "resultado": "aprobado" if aprobado else "rechazado",
        "archivos_recibidos": {
            "contrato": firma_contrato.filename,
            "dni": firma_dni.filename
        }
    }
