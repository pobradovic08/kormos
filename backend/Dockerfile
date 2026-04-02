# Stage 1: Build Go binaries
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app

# Cache dependency downloads
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build all binaries
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/server   ./cmd/server
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/migrate  ./cmd/migrate
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/seed     ./cmd/seed

# Stage 2: Minimal runtime image
FROM alpine:3.19

# ca-certificates required for HTTPS connections to RouterOS devices
RUN apk add --no-cache ca-certificates

WORKDIR /app

COPY --from=builder /out/server  ./server
COPY --from=builder /out/migrate ./migrate
COPY --from=builder /out/seed    ./seed

EXPOSE 8080

CMD ["./server"]
