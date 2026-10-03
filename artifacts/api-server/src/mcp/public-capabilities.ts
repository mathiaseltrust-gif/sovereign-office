export const PUBLIC_MCP_PROTOCOL_VERSION = "2026-07-28";
export const PUBLIC_MCP_SERVER_INFO = {
  name: "sovereign-office-public",
  version: "0.1.0",
};

export const PUBLIC_MCP_PROFILE = {
  roleKey: "visitor_media",
  label: "Visitor / Media",
  accessClass: "public",
  posture: "least_privilege",
  storage: "stateless",
  automaticCapabilities: [
    "read_public_office_information",
    "read_public_capability_manifest",
    "use_public_heritage_guide",
    "use_public_prompts",
  ],
  unavailableUntilPublished: [
    "search_public_records",
    "search_public_law",
  ],
  deniedCapabilities: [
    "read_internal_case_files",
    "read_member_records",
    "read_private_lineage",
    "read_medical_records",
    "read_internal_correspondence",
    "read_trust_assets",
    "read_board_records",
    "issue_documents",
    "send_external_communications",
    "sign_or_file_documents",
    "alter_permanent_records",
    "delete_records",
    "initiate_financial_transactions",
  ],
  principle: "AI may only access capabilities exposed by the Office authority layer.",
} as const;

export const PUBLIC_OFFICE_RESOURCE = {
  office: "Office of the Chief Justice & Trustee",
  organization: "Mathias El Tribe",
  portal: "Visitor & Media Portal",
  access: "Public information only",
  privacy: "The public Heritage Guide is stateless and does not retain visitor conversation history.",
  note: "Internal tribal records, member information, medical information, private lineage, case strategy, trust records, and governance records are not exposed through this public MCP profile.",
} as const;

export const PUBLIC_MCP_TOOLS = [
  {
    name: "public.get_capabilities",
    title: "Public MCP Capabilities",
    description: "Return the Visitor / Media MCP capability profile and its access boundaries.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "public.get_office_info",
    title: "Public Sovereign Office Information",
    description: "Return public-facing information about the Sovereign Office Visitor / Media portal.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "public.ask_heritage_guide",
    title: "Heritage Guide",
    description: "Ask the stateless public Heritage Guide about ancestry, family roots, oral history, and genealogy research.",
    inputSchema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          minLength: 1,
          maxLength: 2000,
          description: "The visitor's ancestry or heritage question.",
        },
        history: {
          type: "array",
          maxItems: 10,
          description: "Optional short conversation history for this request only. It is not persisted by the MCP tool.",
          items: {
            type: "object",
            properties: {
              role: { type: "string", enum: ["user", "assistant"] },
              content: { type: "string", maxLength: 1000 },
            },
            required: ["role", "content"],
            additionalProperties: false,
          },
        },
      },
      required: ["question"],
      additionalProperties: false,
    },
  },
] as const;

export const PUBLIC_MCP_RESOURCES = [
  {
    uri: "sovereign-office://public/capabilities",
    name: "Visitor / Media Capability Profile",
    title: "Sovereign Office Public MCP Capabilities",
    description: "The public MCP capability manifest and explicit access boundaries.",
    mimeType: "application/json",
  },
  {
    uri: "sovereign-office://public/office",
    name: "Public Office Information",
    title: "Sovereign Office Visitor / Media Information",
    description: "Public-facing Office and portal information.",
    mimeType: "application/json",
  },
] as const;

export const PUBLIC_MCP_PROMPTS = [
  {
    name: "heritage-research-guide",
    title: "Heritage Research Guide",
    description: "Create a careful first-step research plan for ancestry or family-history questions.",
    arguments: [
      {
        name: "topic",
        description: "The family, place, ancestor, surname, or heritage question to research.",
        required: true,
      },
    ],
  },
] as const;
