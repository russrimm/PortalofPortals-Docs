# Azure DevOps Service Endpoints Configuration

To use the Azure DevOps Service Endpoints feature, add these environment variables to your `.env.local` file:

```bash
# Azure DevOps Configuration
AZURE_DEVOPS_ORGANIZATION=your-organization-name
AZURE_DEVOPS_PROJECT=your-project-name
AZURE_DEVOPS_PAT=your-personal-access-token
```

## Getting a Personal Access Token (PAT)

1. Go to https://dev.azure.com/{your-organization}/_usersSettings/tokens
2. Click "New Token"
3. Give it a name (e.g., "Portal 360 Service Endpoints")
4. Set the expiration
5. Select scopes:
   - **Service Connections**: Read
6. Click "Create"
7. Copy the token and add it to your `.env.local` file

## Finding Your Organization and Project

- **Organization**: The first part of your Azure DevOps URL
  - Example: `https://dev.azure.com/contoso` → organization is `contoso`
  
- **Project**: The project name in your Azure DevOps
  - Example: `https://dev.azure.com/contoso/MyProject` → project is `MyProject`

## API Reference

This feature uses the [Azure DevOps Service Endpoint REST API](https://learn.microsoft.com/en-us/rest/api/azure/devops/serviceendpoint/endpoints/get-service-endpoints?view=azure-devops-rest-7.1)

Endpoint: `GET https://dev.azure.com/{organization}/{project}/_apis/serviceendpoint/endpoints?api-version=7.1`

## Service Endpoint Types

Common types you may see:
- `azurerm` - Azure Resource Manager connection
- `kubernetes` - Kubernetes service connection
- `github` - GitHub service connection
- `dockerregistry` - Docker Registry connection
- `npm` - npm service connection
- `generic` - Generic service connection
