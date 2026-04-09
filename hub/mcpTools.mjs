export function getMcpTools() {
  return [
    {
      name: 'capture_search_demand_insights',
      description:
        'Capture bounded browser-assisted demand research from Google Keyword Planner and/or Google Trends using a dedicated authenticated research-browser session. Defaults to background mode, prefers headless capture where possible, and saves screenshots, raw rendered HTML, normalized JSON, and markdown artifacts.',
      inputSchema: {
        type: 'object',
        properties: {
          project_slug: { type: 'string' },
          seed_queries: { type: 'array', items: { type: 'string' } },
          market: { type: 'string' },
          language: { type: 'string' },
          mode: { type: 'string', enum: ['background', 'manual'] },
          sources: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['google_keyword_planner', 'google_trends']
            }
          },
          session_hint: { type: 'string' },
          notes: { type: 'string' }
        },
        required: ['project_slug', 'seed_queries']
      }
    },
    {
      name: 'collect_owner_media',
      description:
        'Collect approved owner media from explicit URLs or approved local files into the local operator-hub asset store. Supports direct-image ingest and bounded screenshots for approved pages.',
      inputSchema: {
        type: 'object',
        properties: {
          projectSlug: { type: 'string' },
          approvedUrls: { type: 'array', items: { type: 'string' } },
          approvedLocalPaths: { type: 'array', items: { type: 'string' } },
          assetTypes: { type: 'array', items: { type: 'string' } },
          maxAssets: { type: 'number' }
        },
        required: ['projectSlug', 'assetTypes']
      }
    },
    {
      name: 'search_stock_media',
      description:
        'Search approved stock-photo providers for bounded visual candidates. Returns metadata and provenance only; does not download assets.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          providers: { type: 'array', items: { type: 'string' } },
          orientation: { type: 'string' },
          maxResults: { type: 'number' }
        },
        required: ['query']
      }
    },
    {
      name: 'collect_stock_media',
      description:
        'Collect explicitly selected stock assets into the local operator-hub stock-media store with provenance metadata.',
      inputSchema: {
        type: 'object',
        properties: {
          projectSlug: { type: 'string' },
          selections: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                provider: { type: 'string' },
                id: { type: 'string' },
                assetType: { type: 'string' },
                title: { type: 'string' },
                sourceUrl: { type: 'string' },
                downloadUrl: { type: 'string' },
                creatorName: { type: 'string' },
                creatorUrl: { type: 'string' },
                license: { type: 'string' }
              },
              required: ['provider', 'id', 'sourceUrl', 'downloadUrl']
            }
          }
        },
        required: ['projectSlug', 'selections']
      }
    },
    {
      name: 'capture_public_profile_preview',
      description:
        'Capture a bounded screenshot preview for one explicit public profile or page URL and save it locally with provenance metadata.',
      inputSchema: {
        type: 'object',
        properties: {
          projectSlug: { type: 'string' },
          approvedUrl: { type: 'string' },
          label: { type: 'string' },
          viewportWidth: { type: 'number' },
          viewportHeight: { type: 'number' }
        },
        required: ['projectSlug', 'approvedUrl']
      }
    },
    {
      name: 'render_site_hero_motion',
      description:
        'Prepare and render a bounded scene-driven hero-motion video from collected media. Supports brief-based defaults via template/focus/tone/pace and also accepts explicit scenes[]. Templates: founder_intro, startup_signal, product_story, case_strip. Scene types: full_bleed_photo, split_product, headline_overlay, proof_grid, founder_closeup, device_focus, ambient_logo_strip.',
      inputSchema: {
        type: 'object',
        properties: {
          projectSlug: { type: 'string' },
          title: { type: 'string' },
          durationInSeconds: { type: 'number' },
          fps: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          template: { type: 'string', enum: ['founder_intro', 'startup_signal', 'product_story', 'case_strip'] },
          focus: { type: 'string', enum: ['founder', 'product', 'brand', 'mixed'] },
          tone: { type: 'string', enum: ['clean_premium', 'operator_tech', 'bold_editorial', 'calm_trust'] },
          pace: { type: 'string', enum: ['slow', 'medium', 'fast'] },
          cta: { type: 'string' },
          contentArea: { type: 'string' },
          aspectRatio: { type: 'string', enum: ['square', 'portrait', 'landscape'] },
          style: { type: 'string' },
          ownerAssetPaths: { type: 'array', items: { type: 'string' } },
          stockAssetPaths: { type: 'array', items: { type: 'string' } },
          previewAssetPaths: { type: 'array', items: { type: 'string' } },
          scenes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                type: {
                  type: 'string',
                  enum: [
                    'full_bleed_photo',
                    'split_product',
                    'headline_overlay',
                    'proof_grid',
                    'founder_closeup',
                    'device_focus',
                    'ambient_logo_strip'
                  ]
                },
                durationFrames: { type: 'number' },
                primaryAsset: { type: 'string' },
                supportingAssets: { type: 'array', items: { type: 'string' } },
                headline: { type: 'string' },
                subheadline: { type: 'string' },
                kicker: { type: 'string' },
                align: { type: 'string', enum: ['left', 'center', 'right'] },
                overlayStyle: { type: 'string', enum: ['dark_gradient', 'light_fade', 'soft_panel', 'none'] },
                motionStyle: { type: 'string', enum: ['slow_push', 'steady', 'drift_left', 'drift_right'] }
              }
            }
          }
        },
        required: ['projectSlug']
      }
    },
    {
      name: 'render_service_explainer_motion',
      description:
        'Prepare and render a bounded service-explainer motion video for process storytelling and service pages. First version focuses on three_step_process with problem_flow, decision_router, and outcome_dashboard scenes. Uses local owner-media or collected stock-media assets, not freeform external URLs.',
      inputSchema: {
        type: 'object',
        properties: {
          projectSlug: { type: 'string' },
          title: { type: 'string' },
          mode: { type: 'string', enum: ['three_step_process', 'before_after', 'service_spotlight'] },
          serviceType: { type: 'string', enum: ['automation', 'integration', 'internal_tools', 'generic'] },
          tone: { type: 'string', enum: ['clean_premium', 'operator_tech', 'bold_editorial', 'calm_trust'] },
          pace: { type: 'string', enum: ['slow', 'medium', 'fast'] },
          aspectRatio: { type: 'string', enum: ['square', 'portrait', 'landscape'] },
          durationInSeconds: { type: 'number' },
          fps: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          contentArea: { type: 'string' },
          palette: {
            type: 'object',
            properties: {
              bgDark: { type: 'string' },
              bgLight: { type: 'string' },
              accent: { type: 'string' },
              accentCool: { type: 'string' }
            }
          },
          brief: {
            type: 'object',
            properties: {
              problem: { type: 'string' },
              decision: { type: 'string' },
              outcome: { type: 'string' }
            }
          },
          ownerAssetPaths: { type: 'array', items: { type: 'string' } },
          stockAssetPaths: { type: 'array', items: { type: 'string' } },
          scenes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                type: {
                  type: 'string',
                  enum: [
                    'problem_flow',
                    'decision_router',
                    'outcome_dashboard',
                    'before_after_split',
                    'service_path_strip'
                  ]
                },
                durationFrames: { type: 'number' },
                primaryAsset: { type: 'string' },
                supportingAssets: { type: 'array', items: { type: 'string' } },
                headline: { type: 'string' },
                subheadline: { type: 'string' },
                kicker: { type: 'string' },
                align: { type: 'string', enum: ['left', 'center', 'right'] },
                overlayStyle: { type: 'string', enum: ['dark_gradient', 'light_fade', 'soft_panel', 'none'] },
                motionStyle: { type: 'string', enum: ['slow_push', 'steady', 'drift_left', 'drift_right'] },
                items: { type: 'array', items: { type: 'string' } },
                paths: { type: 'array', items: { type: 'string' } },
                outcomes: { type: 'array', items: { type: 'string' } },
                highlightedPath: { type: 'string' },
                state: { type: 'string', enum: ['broken', 'mixed', 'calm'] }
              }
            }
          }
        },
        required: ['projectSlug']
      }
    },
    {
      name: 'list_projects',
      description: 'List available projects discovered by the local hub.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'get_project_summary',
      description: 'Return a compact summary of a project for AI planning and skill routing.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' }
        },
        required: ['projectId']
      }
    },
    {
      name: 'get_graph',
      description: 'Return the current project graph JSON.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' }
        },
        required: ['projectId']
      }
    },
    {
      name: 'save_graph',
      description: 'Persist an updated project graph JSON.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          graph: { type: 'object' }
        },
        required: ['projectId', 'graph']
      }
    },
    {
      name: 'get_outreach_projection',
      description: 'Return derived outreach rows from the graph.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' }
        },
        required: ['projectId']
      }
    },
    {
      name: 'list_excel_files',
      description: 'List Excel files from the signed-in Microsoft account drive.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'number' }
        },
        required: []
      }
    },
    {
      name: 'list_project_excel_files',
      description: 'List Excel files from the Microsoft folder bound to a specific project.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          limit: { type: 'number' }
        },
        required: ['projectId']
      }
    },
    {
      name: 'create_project_excel_file',
      description:
        'Create an Excel file in the Microsoft folder bound to a specific project using the local project workbook template.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          fileName: { type: 'string' }
        },
        required: ['projectId', 'fileName']
      }
    },
    {
      name: 'get_project_workbook_metadata',
      description:
        'Read workbook metadata and worksheet names for an Excel file in the Microsoft folder bound to a specific project.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          fileId: { type: 'string' }
        },
        required: ['projectId', 'fileId']
      }
    },
    {
      name: 'read_project_workbook_range',
      description:
        'Read a worksheet range from an Excel file in the Microsoft folder bound to a specific project.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          fileId: { type: 'string' },
          worksheetName: { type: 'string' },
          address: { type: 'string' }
        },
        required: ['projectId', 'fileId', 'worksheetName', 'address']
      }
    },
    {
      name: 'write_project_workbook_range',
      description:
        'Write a 2D value array into a worksheet range in an Excel file in the Microsoft folder bound to a specific project.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          fileId: { type: 'string' },
          worksheetName: { type: 'string' },
          address: { type: 'string' },
          values: { type: 'array' }
        },
        required: ['projectId', 'fileId', 'worksheetName', 'address', 'values']
      }
    },
    {
      name: 'list_calendar_events',
      description: 'List events from the signed-in Microsoft calendar for a given time range.',
      inputSchema: {
        type: 'object',
        properties: {
          startDateTime: { type: 'string' },
          endDateTime: { type: 'string' }
        },
        required: []
      }
    },
    {
      name: 'create_calendar_event',
      description: 'Create an event in the signed-in Microsoft calendar.',
      inputSchema: {
        type: 'object',
        properties: {
          subject: { type: 'string' },
          body: { type: 'string' },
          startDateTime: { type: 'string' },
          endDateTime: { type: 'string' },
          timeZone: { type: 'string' }
        },
        required: ['subject', 'startDateTime', 'endDateTime']
      }
    },
    {
      name: 'create_planner_board',
      description: 'Create a new planner board with default workflow columns.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          boardType: { type: 'string' }
        },
        required: ['name']
      }
    },
    {
      name: 'get_planner_dashboard',
      description: 'Return the current personal operator dashboard payload.',
      inputSchema: {
        type: 'object',
        properties: {
          mode: { type: 'string' }
        },
        required: []
      }
    },
    {
      name: 'list_planner_boards',
      description: 'List available planner boards.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'get_planner_board',
      description: 'Return a planner board with its columns and work items.',
      inputSchema: {
        type: 'object',
        properties: {
          boardId: { type: 'string' }
        },
        required: ['boardId']
      }
    },
    {
      name: 'create_planner_work_item',
      description: 'Create a new planner work item.',
      inputSchema: {
        type: 'object',
        properties: {
          boardId: { type: 'string' },
          columnId: { type: 'string' },
          title: { type: 'string' },
          details: { type: 'string' },
          importance: { type: 'string' },
          frictionType: { type: 'string' }
        },
        required: ['boardId', 'title']
      }
    },
    {
      name: 'move_planner_work_item',
      description: 'Move an existing planner work item to another column or focus date.',
      inputSchema: {
        type: 'object',
        properties: {
          workItemId: { type: 'string' },
          columnId: { type: 'string' },
          focusDate: { type: 'string' }
        },
        required: ['workItemId', 'columnId']
      }
    }
  ]
}
