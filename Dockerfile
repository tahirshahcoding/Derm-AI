# Use Python 3.10 base image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the project
COPY . .

# Expose the port your Flask app uses
EXPOSE 5000

# Start the app with gunicorn
CMD ["gunicorn", "app:app", "-b", "0.0.0.0:5000"]
