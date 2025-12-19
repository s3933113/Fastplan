import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

// IMPORTANT SECURITY NOTE:
// - Never hardcode the OpenAI API key in the code.
// - Set it as a Forge variable and read it from process.env only.
//   Example (run this in your terminal):
//   - forge variables set OPENAI_API_KEY <your-key> --environment production
//   - forge variables set OPENAI_API_KEY <your-key> --environment development
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';
const APP_VERSION = '2.4.0-openai-api-fetch';

// Resolver for frontend to check the app version (avoids confusion between dev/prod + cache)
resolver.define('getAppInfo', async () => {
    return {
        appVersion: APP_VERSION,
        openAiModel: OPENAI_MODEL,
        hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY)
    };
});

// Resolver to test OpenAI connection directly (does not create Jira issues)
// - Uses the same OpenAI API as generatePlan
// - Returns clear error to the frontend for display
resolver.define('testOpenAIConnection', async () => {
    // Light test with a short prompt
    const testPrompt = 'Return JSON: {"ok": true}';

    try {
        await callOpenAI(testPrompt);
        return { ok: true };
    } catch (error) {
        return {
            ok: false,
            error: error?.message || String(error)
        };
    }
});

// Function to call OpenAI API to analyze prompt and create a plan
// This function sends the prompt to OpenAI and receives the plan structure back
async function callOpenAI(prompt) {
    console.log('=== callOpenAI function called ===');
    console.log('APP_VERSION:', APP_VERSION);
    console.log('Prompt:', prompt);
    console.log('OpenAI API URL:', OPENAI_API_URL);

    // Read API Key from Forge variables only
    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
        // Throw a clear error to stop execution (no fallback/mock data as requested)
        throw new Error(
            'Missing OPENAI_API_KEY. Set it with: forge variables set OPENAI_API_KEY <your-key> (for the same environment you installed)'
        );
    }
    
    // Create system prompt for OpenAI to analyze and generate plan structure
    const systemPrompt = `You are a project planning assistant. Your task is to analyze a user's prompt and create a detailed project plan structure for Jira.

The plan should include:
1. An Epic with a clear title and description
2. Multiple Stories (typically 3-5 stories) that break down the work
3. Each Story should have 3-5 Sub-tasks that detail the specific work items

Return your response as a valid JSON object with this exact structure:
{
  "epic": {
    "title": "Epic title (max 100 characters)",
    "description": "Detailed epic description explaining the overall goal",
    "stories": [
      {
        "title": "Story title (max 100 characters)",
        "description": "Story description",
        "subtasks": [
          {
            "title": "Sub-task title (max 100 characters)"
          }
        ]
      }
    ]
  }
}

Make sure the plan is comprehensive, realistic, and follows software development best practices.`;

    const userPrompt = `Create a detailed project plan for: ${prompt}`;
    
    try {
        console.log('Making request to OpenAI API:', OPENAI_API_URL);
        
        // Create request body
        const requestBody = {
            // Use gpt-4o-mini for cost efficiency or change to gpt-4o for higher accuracy
            model: OPENAI_MODEL,
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: userPrompt
                }
            ],
            temperature: 0.7,
            max_tokens: 2000,
            response_format: { type: 'json_object' } // Force JSON response
        };
        
        console.log('Request body prepared, sending request...');
        console.log('Request body size:', JSON.stringify(requestBody).length, 'bytes');
        
        // IMPORTANT:
        // Forge apps should make external HTTP calls via api.fetch only to ensure egress allowlist works correctly.
        // (global fetch / axios / node-fetch might not work reliably in Forge runtime)
        const response = await api.fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openAiApiKey}`
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('Response status:', response.status, response.statusText);
        
        // Read response text first
        const responseText = await response.text();
        console.log('Response text length:', responseText.length);
        
        if (!response.ok) {
            // Don't log full body to avoid logging too much sensitive info
            const preview = responseText.substring(0, 300);
            console.error('OpenAI API error response preview:', preview);
            throw new Error(`OpenAI API error: ${response.status} - ${preview}`);
        }
        
        // Parse JSON response
        let data;
        try {
            data = JSON.parse(responseText);
            console.log('Parsed response data structure:', Object.keys(data));
        } catch (parseError) {
            console.error('Failed to parse response as JSON:', parseError);
            console.error('Response text:', responseText);
            throw new Error(`Failed to parse OpenAI response as JSON: ${parseError.message}`);
        }
        
        // Check if response contains expected data
        if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
            console.error('Invalid response structure:', JSON.stringify(data, null, 2));
            throw new Error('OpenAI API returned invalid response structure');
        }
        
        if (!data.choices[0].message || !data.choices[0].message.content) {
            console.error('Response missing message content:', JSON.stringify(data, null, 2));
            throw new Error('OpenAI API response missing message content');
        }
        
        // Parse JSON response from OpenAI
        let plan;
        try {
            const content = data.choices[0].message.content;
            console.log('Message content received, length:', content.length);
            console.log('Message content preview:', content.substring(0, 200));
            
            plan = JSON.parse(content);
            console.log('Parsed plan structure:', Object.keys(plan));
            
            // Validate plan structure
            if (!plan.epic || !plan.epic.title || !plan.epic.stories || !Array.isArray(plan.epic.stories)) {
                console.error('Invalid plan structure:', JSON.stringify(plan, null, 2));
                throw new Error('Invalid plan structure from OpenAI - missing required fields');
            }
            
            console.log('Plan generated successfully by OpenAI:', JSON.stringify(plan, null, 2));
            
        } catch (parseError) {
            console.error('Error parsing OpenAI response content:', parseError);
            console.error('Response content:', data.choices[0].message.content);
            throw new Error(`Failed to parse OpenAI response content as JSON: ${parseError.message}`);
        }
        
        return plan;
        
    } catch (error) {
        console.error('=== Error calling OpenAI API ===');
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        // Create a clear error message
        let errorMessage = 'Unable to connect to OpenAI API';
        
        if (error.message) {
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                errorMessage = 'Invalid or expired OpenAI API Key. Please check your API Key.';
            } else if (error.message.includes('429') || error.message.includes('rate limit')) {
                errorMessage = 'OpenAI API rate limit exceeded. Please wait a moment and try again.';
            } else if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) {
                errorMessage = 'Unable to connect to OpenAI API. Please check your internet connection.';
            } else if (error.message.includes('Fetch function is not available')) {
                errorMessage = 'The system cannot invoke the HTTP request. Please contact the administrator.';
            } else {
                errorMessage = `An error occurred from OpenAI API: ${error.message}`;
            }
        }
        
        console.error('Throwing error:', errorMessage);
        throw new Error(errorMessage);
    }
}

// Function to generate a plan from a prompt using OpenAI API
// This function calls OpenAI API to analyze the prompt and generate Epic -> Stories -> Sub-tasks structure
resolver.define('generatePlan', async (req) => {
    const { prompt } = req.payload;
    
    if (!prompt || !prompt.trim()) {
        throw new Error('Prompt is required');
    }
    
    console.log('=== generatePlan called ===');
    console.log('Prompt received:', prompt);
    
    try {
        // Call OpenAI API to analyze prompt and generate plan
        console.log('Calling callOpenAI function...');
        const plan = await callOpenAI(prompt);
        
        console.log('Plan generated by OpenAI:', JSON.stringify(plan, null, 2));
        
        return plan;
    } catch (error) {
        console.error('Error in generatePlan:', error);
        throw error;
    }
});

// Function to generate a plan and automatically create issues in Jira
// This function calls OpenAI API to analyze the prompt, generate a plan, and create issues in Jira immediately
// Created issues will appear in the backlog automatically
resolver.define('generateAndCreateIssues', async (req) => {
    const { prompt } = req.payload;
    
    if (!prompt || !prompt.trim()) {
        throw new Error('Prompt is required');
    }
    
    console.log('=== generateAndCreateIssues called ===');
    console.log('Prompt received:', prompt);
    console.log('Project key:', req.context?.extension?.project?.key);
    
    // Check if project key is available
    const projectKey = req.context?.extension?.project?.key;
    if (!projectKey) {
        throw new Error('Project key is not available in context');
    }
    
    // 2. Create issues in Jira according to the plan from OpenAI API
    const createdIssues = [];
    let epicKey = null;
    
    try {
        // 1. Call OpenAI API to analyze prompt and generate plan
        console.log('Calling callOpenAI function...');
        const plan = await callOpenAI(prompt);
        
        if (!plan || !plan.epic) {
            throw new Error('Failed to generate plan from OpenAI API - plan structure is invalid');
        }
        
        console.log('Plan generated by OpenAI API successfully');
        console.log('Plan structure:', JSON.stringify(plan, null, 2));
        console.log('Now creating issues in Jira...');
        // 1. Create Epic
        const epicResponse = await api.asUser().requestJira(route`/rest/api/3/issue`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fields: {
                    project: {
                        key: projectKey
                    },
                    summary: plan.epic.title,
                    description: {
                        type: 'doc',
                        version: 1,
                        content: [
                            {
                                type: 'paragraph',
                                content: [
                                    {
                                        type: 'text',
                                        text: plan.epic.description || plan.epic.title
                                    }
                                ]
                            }
                        ]
                    },
                    issuetype: {
                        name: 'Epic'
                    }
                }
            })
        });
        
        if (!epicResponse.ok) {
            const errorText = await epicResponse.text();
            throw new Error(`Failed to create Epic: ${errorText}`);
        }
        
        const epicData = await epicResponse.json();
        epicKey = epicData.key;
        createdIssues.push({ key: epicKey, type: 'Epic', title: plan.epic.title });
        
        console.log('Created Epic:', epicKey);
        
        // 2. Create Stories and Sub-tasks
        if (plan.epic.stories && plan.epic.stories.length > 0) {
            for (const story of plan.epic.stories) {
                // Create Story - use Epic Link custom field
                const storyFields = {
                    project: {
                        key: projectKey
                    },
                    summary: story.title,
                    description: {
                        type: 'doc',
                        version: 1,
                        content: [
                            {
                                type: 'paragraph',
                                content: [
                                    {
                                        type: 'text',
                                        text: story.description || story.title
                                    }
                                ]
                            }
                        ]
                    },
                    issuetype: {
                        name: 'Story'
                    }
                };
                
                // Add Epic Link (customfield_10011 is default Epic Link field)
                try {
                    storyFields.customfield_10011 = epicKey;
                } catch (e) {
                    console.log('Epic Link field may not be available');
                }
                
                const storyResponse = await api.asUser().requestJira(route`/rest/api/3/issue`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        fields: storyFields
                    })
                });
                
                if (!storyResponse.ok) {
                    const errorText = await storyResponse.text();
                    console.error(`Failed to create Story: ${errorText}`);
                    continue;
                }
                
                const storyData = await storyResponse.json();
                const storyKey = storyData.key;
                createdIssues.push({ key: storyKey, type: 'Story', title: story.title });
                
                console.log('Created Story:', storyKey);
                
                // Create Sub-tasks
                if (story.subtasks && story.subtasks.length > 0) {
                    for (const subtask of story.subtasks) {
                        const subtaskResponse = await api.asUser().requestJira(route`/rest/api/3/issue`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                fields: {
                                    project: {
                                        key: projectKey
                                    },
                                    summary: subtask.title,
                                    description: {
                                        type: 'doc',
                                        version: 1,
                                        content: [
                                            {
                                                type: 'paragraph',
                                                content: [
                                                    {
                                                        type: 'text',
                                                        text: subtask.title
                                                    }
                                                ]
                                            }
                                        ]
                                    },
                                    issuetype: {
                                        name: 'Sub-task'
                                    },
                                    parent: {
                                        key: storyKey
                                    }
                                }
                            })
                        });
                        
                        if (!subtaskResponse.ok) {
                            const errorText = await subtaskResponse.text();
                            console.error(`Failed to create Sub-task: ${errorText}`);
                            continue;
                        }
                        
                        const subtaskData = await subtaskResponse.json();
                        createdIssues.push({ key: subtaskData.key, type: 'Sub-task', title: subtask.title });
                        
                        console.log('Created Sub-task:', subtaskData.key);
                    }
                }
            }
        }
        
        return {
            success: true,
            createdCount: createdIssues.length,
            issues: createdIssues,
            plan: plan, // Send plan back for frontend preview
            message: `Successfully created ${createdIssues.length} issues in Jira. They will appear in the backlog.`
        };
        
    } catch (error) {
        console.error('Error generating plan or creating issues:', error);
        throw new Error(`Failed to generate plan or create issues: ${error.message}`);
    }
});

// Function to create issues in Jira (for manual creation cases)
// Creates Epic, Stories, and Sub-tasks based on the plan
resolver.define('createIssues', async (req) => {
    const { plan } = req.payload;
    
    console.log('Creating issues for plan:', plan);
    
    if (!plan || !plan.epic) {
        throw new Error('Invalid plan structure');
    }
    
    const createdIssues = [];
    let epicKey = null;
    const projectKey = req.context.extension.project.key;
    
    try {
        // 1. Create Epic
        const epicResponse = await api.asUser().requestJira(route`/rest/api/3/issue`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fields: {
                    project: {
                        key: projectKey
                    },
                    summary: plan.epic.title,
                    description: {
                        type: 'doc',
                        version: 1,
                        content: [
                            {
                                type: 'paragraph',
                                content: [
                                    {
                                        type: 'text',
                                        text: plan.epic.description || plan.epic.title
                                    }
                                ]
                            }
                        ]
                    },
                    issuetype: {
                        name: 'Epic'
                    }
                }
            })
        });
        
        if (!epicResponse.ok) {
            const errorText = await epicResponse.text();
            throw new Error(`Failed to create Epic: ${errorText}`);
        }
        
        const epicData = await epicResponse.json();
        epicKey = epicData.key;
        createdIssues.push({ key: epicKey, type: 'Epic', title: plan.epic.title });
        
        console.log('Created Epic:', epicKey);
        
        // 2. Create Stories and Sub-tasks
        if (plan.epic.stories && plan.epic.stories.length > 0) {
            for (const story of plan.epic.stories) {
                // Create Story - use Epic Link custom field
                const storyFields = {
                    project: {
                        key: projectKey
                    },
                    summary: story.title,
                    description: {
                        type: 'doc',
                        version: 1,
                        content: [
                            {
                                type: 'paragraph',
                                content: [
                                    {
                                        type: 'text',
                                        text: story.description || story.title
                                    }
                                ]
                            }
                        ]
                    },
                    issuetype: {
                        name: 'Story'
                    }
                };
                
                // Add Epic Link (customfield_10011 is default Epic Link field)
                try {
                    storyFields.customfield_10011 = epicKey;
                } catch (e) {
                    console.log('Epic Link field may not be available');
                }
                
                const storyResponse = await api.asUser().requestJira(route`/rest/api/3/issue`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        fields: storyFields
                    })
                });
                
                if (!storyResponse.ok) {
                    const errorText = await storyResponse.text();
                    console.error(`Failed to create Story: ${errorText}`);
                    continue;
                }
                
                const storyData = await storyResponse.json();
                const storyKey = storyData.key;
                createdIssues.push({ key: storyKey, type: 'Story', title: story.title });
                
                console.log('Created Story:', storyKey);
                
                // Create Sub-tasks
                if (story.subtasks && story.subtasks.length > 0) {
                    for (const subtask of story.subtasks) {
                        const subtaskResponse = await api.asUser().requestJira(route`/rest/api/3/issue`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                fields: {
                                    project: {
                                        key: projectKey
                                    },
                                    summary: subtask.title,
                                    description: {
                                        type: 'doc',
                                        version: 1,
                                        content: [
                                            {
                                                type: 'paragraph',
                                                content: [
                                                    {
                                                        type: 'text',
                                                        text: subtask.title
                                                    }
                                                ]
                                            }
                                        ]
                                    },
                                    issuetype: {
                                        name: 'Sub-task'
                                    },
                                    parent: {
                                        key: storyKey
                                    }
                                }
                            })
                        });
                        
                        if (!subtaskResponse.ok) {
                            const errorText = await subtaskResponse.text();
                            console.error(`Failed to create Sub-task: ${errorText}`);
                            continue;
                        }
                        
                        const subtaskData = await subtaskResponse.json();
                        createdIssues.push({ key: subtaskData.key, type: 'Sub-task', title: subtask.title });
                        
                        console.log('Created Sub-task:', subtaskData.key);
                    }
                }
            }
        }
        
        return {
            success: true,
            createdCount: createdIssues.length,
            issues: createdIssues
        };
        
    } catch (error) {
        console.error('Error creating issues:', error);
        throw new Error(`Failed to create issues: ${error.message}`);
    }
});

export const handler = resolver.getDefinitions();
