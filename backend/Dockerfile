FROM node:20-alpine
WORKDIR /app

# Install git, Python, pip and build tools needed for better-sqlite3 compilation FIRST
RUN apk add --no-cache git python3 py3-pip make g++ sqlite-dev

# Copy package and dependency files
COPY package*.json ./
COPY requirements.txt ./

# Create and use a venv (preferred way on Alpine)
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python and Node dependencies
RUN pip3 install --no-cache-dir -r requirements.txt
RUN npm install --production

# Set up git config
RUN git config --global user.name "MTT Platform"
RUN git config --global user.email "mtt@localhost"

# Copy the rest of the application files (invalidates cache only for code changes, not dependencies)
COPY . . 

EXPOSE 5000
CMD ["npm", "start"]