# สูตรสร้าง "กล่อง" (container) สำหรับรัน API บน Render
# Render อ่านไฟล์นี้แล้วทำตามทีละขั้นเอง เราไม่ต้องรันในเครื่อง

# ขั้นที่ 1: ใช้เครื่องมือ .NET SDK ตัวเต็ม build โปรเจกต์
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY NakcatApi.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app

# ขั้นที่ 2: เอาเฉพาะผลที่ build แล้ว ใส่กล่องเล็กที่มีแค่ตัวรัน (ไม่มี SDK) จะได้เบาและเร็ว
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
# Render บอกพอร์ตผ่านตัวแปร PORT (ถ้าไม่มีใช้ 8080)
CMD ["sh", "-c", "ASPNETCORE_HTTP_PORTS=${PORT:-8080} exec dotnet NakcatApi.dll"]
