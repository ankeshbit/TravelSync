FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies
COPY ml_service/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy service code and dataset
COPY ml_service /app/ml_service
COPY ML /app/ML

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV TRAVELSYNC_CSV_PATH=/app/ML/travelsync_destin.original.csv
ENV PORT=8000

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "ml_service.main:app", "--host", "0.0.0.0", "--port", "8000"]
