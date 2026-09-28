# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["LocalShop.Api/LocalShop.Api.csproj", "LocalShop.Api/"]
RUN dotnet restore "LocalShop.Api/LocalShop.Api.csproj"
COPY LocalShop.Api/ LocalShop.Api/
WORKDIR "/src/LocalShop.Api"
RUN dotnet publish "LocalShop.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Cloud Run binds to $PORT or default 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

ENTRYPOINT ["dotnet", "LocalShop.Api.dll"]
