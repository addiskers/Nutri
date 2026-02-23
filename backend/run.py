"""
Quick start script for development
"""
import uvicorn

if __name__ == "__main__":
    print("Starting NutriEyeQ Backend Server...")
    print("API Docs: http://localhost:8000/docs")
    print("Press CTRL+C to stop\n")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

