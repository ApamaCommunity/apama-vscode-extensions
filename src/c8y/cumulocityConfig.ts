import * as vscode from "vscode";

export class CumulocityConfig {
  private config: vscode.WorkspaceConfiguration;

  constructor() {
    this.config = vscode.workspace.getConfiguration("apama.c8y");
  }

  /**
   * Get the Cumulocity tenant
   */
  getTenant(): string {
    return this.config.get("tenant", "");
  }

  /**
   * Get the Cumulocity username
   */
  getUser(): string {
    return this.config.get("user", "");
  }

  /**
   * Get the Cumulocity password
   */
  getPassword(): string {
    return this.config.get("password", "");
  }

  /**
   * Get the Cumulocity base URL
   */
  getBaseUrl(): string {
    return this.config.get("url", "");
  }

  /**
   * Get the Cumulocity EPL files URL
   * @param includeContents Whether to include contents in the URL query
   */
  getEplFilesUrl(includeContents: boolean = false): string {
    let url: string = this.getBaseUrl();
    if (!url.endsWith("/")) {
      url += "/";
    }
    url += "service/cep/eplfiles";
    
    if (includeContents) {
      url += "?contents=true";
    }
    
    return url;
  }

  /**
   * Get authentication configuration for axios
   */
  getAuthConfig(): { username: string; password: string } {
    return {
      username: this.getUser(),
      password: this.getPassword(),
    };
  }

  /**
   * Get basic authentication configuration for C8Y client
   */
  getBasicAuthConfig(): { tenant: string; user: string; password: string } {
    return {
      tenant: this.getTenant(),
      user: this.getUser(),
      password: this.getPassword(),
    };
  }
}