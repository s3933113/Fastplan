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
// model: Optional model name (defaults to OPENAI_MODEL if not provided)
// complexity: Optional complexity level ('MVP', 'Standard', 'Enterprise')
async function callOpenAI(prompt, model = null, complexity = 'MVP') {
    const selectedModel = model || OPENAI_MODEL;
    console.log('=== callOpenAI function called ===');
    console.log('APP_VERSION:', APP_VERSION);
    console.log('Prompt:', prompt);
    console.log('Selected Model:', selectedModel);
    console.log('Complexity Level:', complexity);
    console.log('OpenAI API URL:', OPENAI_API_URL);

    // Read API Key from Forge variables only
    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
        // Throw a clear error to stop execution (no fallback/mock data as requested)
        throw new Error(
            'Missing OPENAI_API_KEY. Set it with: forge variables set OPENAI_API_KEY <your-key> (for the same environment you installed)'
        );
    }
    
    // Create system prompt based on complexity level
    let complexityInstructions = '';
    
    if (complexity === 'MVP') {
        complexityInstructions = `COMPLEXITY: MVP (Minimum Viable Product)
- Focus ONLY on core value and essential features
- Generate approximately 3-5 critical User Stories
- Keep it simple and minimal - only what's absolutely necessary to deliver value
- Each Story should have detailed description and 2-4 acceptance criteria
- Avoid nice-to-have features, focus on must-have functionality`;
    } else if (complexity === 'Standard') {
        complexityInstructions = `COMPLEXITY: Standard (Full Product)
- Build a complete, production-ready application
- Generate approximately 8-12 User Stories covering main user flows and some edge cases
- Include core features, user authentication, basic error handling, and data validation
- Each Story should have detailed description and 3-5 acceptance criteria
- Consider user experience, basic security, and common use cases`;
    } else if (complexity === 'Enterprise') {
        complexityInstructions = `COMPLEXITY: Enterprise (Scalable & Secure)
- Be extremely detailed and comprehensive
- Generate approximately 15+ User Stories covering all aspects of the system
- MUST include dedicated Stories for:
  * Security: Authentication, Authorization, Data Encryption, Security Auditing
  * Logging & Monitoring: Application Logging, Error Tracking, Performance Monitoring, Audit Trails
  * Scalability: Database Optimization, Caching Strategy, Load Balancing, Performance Tuning
  * CI/CD Pipelines: Automated Testing, Build Automation, Deployment Pipeline, Environment Management
  * Role-Based Access Control (RBAC): User Roles, Permissions Management, Access Control Lists
- Each Story should have detailed description and 4-6 acceptance criteria
- Include infrastructure, compliance, documentation, and operational concerns
- Consider multi-tenancy, disaster recovery, and enterprise-grade features`;
    }
    
    // Create system prompt for OpenAI to analyze and generate plan structure
    const systemPrompt = `You are a project planning assistant. Your task is to analyze a user's prompt and create a detailed project plan structure for Jira.

${complexityInstructions}

The plan should include:
1. An Epic with a clear title, detailed description, priority, acceptance criteria, and list of linked stories
2. Multiple Stories as specified by the complexity level above
3. Each Story should have a detailed description, priority, and acceptance criteria (NO subtasks)

Return your response as a valid JSON object with this exact structure:
{
  "epic": {
    "title": "Epic title (max 100 characters)",
    "description": "Detailed epic description explaining the overall goal, business value, and scope",
    "priority": "High" | "Medium" | "Low" | "Lowest",
    "acceptanceCriteria": [
      "Criterion 1: Clear, testable acceptance criterion",
      "Criterion 2: Another measurable criterion",
      "Criterion 3: Additional criterion if needed"
    ],
    "storyLinks": [
      "Brief description of Story 1 and how it relates to the epic",
      "Brief description of Story 2 and how it relates to the epic"
    ],
    "stories": [
      {
        "title": "Story title (max 100 characters)",
        "description": "Detailed story description explaining what needs to be done and why",
        "priority": "High" | "Medium" | "Low" | "Lowest",
        "storyPoints": 1 | 2 | 3 | 5 | 8 | 13,
        "acceptanceCriteria": [
          "Criterion 1: Clear, testable acceptance criterion for this story",
          "Criterion 2: Another measurable criterion",
          "Criterion 3: Additional criterion if needed"
        ]
      }
    ]
  }
}

IMPORTANT:
- The "storyLinks" array should contain brief descriptions of how each story relates to the epic (one entry per story)
- Priority assignment is CRITICAL - you MUST vary priorities realistically based on actual importance:
  * "High": Only for critical, blocking, or must-have features that are essential for core functionality
  * "Medium": For important features that support core functionality but are not blocking
  * "Low": For nice-to-have features that enhance the product but are not essential
  * "Lowest": For optional features, polish, or enhancements that can be deferred
- DO NOT assign "High" to all stories - distribute priorities realistically (typically: 1-2 High, 2-4 Medium, 2-3 Low, 1-2 Lowest for a typical project)
- The epic priority should reflect the overall project importance
- Each story's priority should be independent and based on its specific business value and urgency
- Story Points: Use Fibonacci sequence (1, 2, 3, 5, 8, 13) to estimate complexity. Assign points based on:
  * 1 = Very simple, minimal effort
  * 2 = Simple, straightforward
  * 3 = Moderate complexity
  * 5 = Complex, requires significant effort
  * 8 = Very complex, multiple components
  * 13 = Extremely complex, high uncertainty or large scope
- Acceptance criteria should be clear, testable, and measurable statements
- The epic description should be comprehensive and explain the business value

Make sure the plan is comprehensive, realistic, and follows software development best practices. Follow the complexity guidelines strictly.`;

    const userPrompt = `Create a detailed project plan for: ${prompt}

CRITICAL: When assigning priorities, analyze each story/epic carefully and assign priorities realistically:
- Not all items should be "High" priority
- Consider which features are truly critical vs. nice-to-have
- Distribute priorities across High, Medium, Low, and Lowest based on actual business value and urgency
- Core functionality = High, Supporting features = Medium, Enhancements = Low, Optional = Lowest`;
    
    try {
        console.log('Making request to OpenAI API:', OPENAI_API_URL);
        
        // Create request body
        const requestBody = {
            // Use the provided model or fall back to default
            model: selectedModel,
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
            
            // Ensure optional fields have defaults if missing for epic
            if (!plan.epic.priority) {
                plan.epic.priority = 'Medium'; // Default priority
            }
            // Validate priority value
            const validPriorities = ['High', 'Medium', 'Low', 'Lowest'];
            if (!validPriorities.includes(plan.epic.priority)) {
                plan.epic.priority = 'Medium'; // Default to Medium if invalid
            }
            if (!plan.epic.acceptanceCriteria || !Array.isArray(plan.epic.acceptanceCriteria)) {
                plan.epic.acceptanceCriteria = []; // Default empty array
            }
            if (!plan.epic.storyLinks || !Array.isArray(plan.epic.storyLinks)) {
                plan.epic.storyLinks = []; // Default empty array
            }
            
            // Ensure optional fields have defaults if missing for stories
            const validStoryPoints = [1, 2, 3, 5, 8, 13];
            plan.epic.stories.forEach((story, idx) => {
                if (!story.priority) {
                    story.priority = 'Medium'; // Default priority
                }
                // Validate priority value
                if (!validPriorities.includes(story.priority)) {
                    story.priority = 'Medium'; // Default to Medium if invalid
                }
                // Validate story points
                if (!story.storyPoints || !validStoryPoints.includes(story.storyPoints)) {
                    story.storyPoints = 3; // Default to 3 if missing or invalid
                }
                if (!story.acceptanceCriteria || !Array.isArray(story.acceptanceCriteria)) {
                    story.acceptanceCriteria = []; // Default empty array
                }
                if (!story.description) {
                    story.description = story.title; // Default to title if no description
                }
            });
            
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
    const { prompt, model, complexity } = req.payload;
    
    if (!prompt || !prompt.trim()) {
        throw new Error('Prompt is required');
    }
    
    // Validate complexity (default to MVP if invalid)
    const validComplexities = ['MVP', 'Standard', 'Enterprise'];
    const selectedComplexity = validComplexities.includes(complexity) ? complexity : 'MVP';
    
    console.log('=== generatePlan called ===');
    console.log('Prompt received:', prompt);
    console.log('Model requested:', model || 'default (gpt-4o-mini)');
    console.log('Complexity level:', selectedComplexity);
    
    try {
        // Call OpenAI API to analyze prompt and generate plan
        console.log('Calling callOpenAI function...');
        const plan = await callOpenAI(prompt, model, selectedComplexity);
        
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
        
        // Build epic description with acceptance criteria and story links
        let epicDescription = plan.epic.description || plan.epic.title;
        
        // Add acceptance criteria section if available
        if (plan.epic.acceptanceCriteria && plan.epic.acceptanceCriteria.length > 0) {
            epicDescription += '\n\n=== Acceptance Criteria ===\n';
            plan.epic.acceptanceCriteria.forEach((criteria, idx) => {
                epicDescription += `${idx + 1}. ${criteria}\n`;
            });
        }
        
        // Add story links section if available
        if (plan.epic.storyLinks && plan.epic.storyLinks.length > 0) {
            epicDescription += '\n=== Linked Stories ===\n';
            plan.epic.storyLinks.forEach((link, idx) => {
                epicDescription += `${idx + 1}. ${link}\n`;
            });
        }
        
        // Build epic fields
        const epicFields = {
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
                                text: epicDescription
                            }
                        ]
                    }
                ]
            },
            issuetype: {
                name: 'Epic'
            }
        };
        
        // Add priority if available (map to Jira priority names)
        if (plan.epic.priority) {
            const priorityMap = {
                'High': 'Highest',
                'Medium': 'Medium',
                'Low': 'Lowest'
            };
            const jiraPriority = priorityMap[plan.epic.priority] || 'Medium';
            epicFields.priority = { name: jiraPriority };
        }
        
        // 1. Create Epic
        const epicResponse = await api.asUser().requestJira(route`/rest/api/3/issue`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fields: epicFields
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
                
                // Build story description with acceptance criteria
                let storyDescription = story.description || story.title;
                
                // Add story points if available
                if (story.storyPoints) {
                    storyDescription += `\n\n=== Story Points ===\n${story.storyPoints} (Fibonacci: 1, 2, 3, 5, 8, 13)`;
                }
                
                // Add acceptance criteria section if available
                if (story.acceptanceCriteria && story.acceptanceCriteria.length > 0) {
                    storyDescription += '\n\n=== Acceptance Criteria ===\n';
                    story.acceptanceCriteria.forEach((criteria, idx) => {
                        storyDescription += `${idx + 1}. ${criteria}\n`;
                    });
                }
                
                storyFields.description = {
                    type: 'doc',
                    version: 1,
                    content: [
                        {
                            type: 'paragraph',
                            content: [
                                {
                                    type: 'text',
                                    text: storyDescription
                                }
                            ]
                        }
                    ]
                };
                
                // Add priority if available (map to Jira priority names)
                if (story.priority) {
                    const priorityMap = {
                        'High': 'High',
                        'Medium': 'Medium',
                        'Low': 'Low',
                        'Lowest': 'Lowest'
                    };
                    const jiraPriority = priorityMap[story.priority] || 'Medium';
                    storyFields.priority = { name: jiraPriority };
                }
                
                // IMPORTANT: Link Story to Epic using parent field (NOT customfield)
                if (epicKey) {
                    storyFields.parent = { key: epicKey };
                    console.log(`Linking Story to Epic: ${epicKey}`);
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
// STRICT EXECUTION ORDER: Epic -> Stories (linked via parent) -> Subtasks (linked via parent)
resolver.define('createIssues', async (req) => {
    const { plan } = req.payload;
    
    console.log('=== createIssues called ===');
    console.log('Plan structure:', JSON.stringify(plan, null, 2));
    
    if (!plan) {
        throw new Error('Invalid plan structure - plan is missing');
    }
    
    const createdIssues = [];
    let epicKey = null;
    const projectKey = req.context?.extension?.project?.key;
    
    if (!projectKey) {
        throw new Error('Project key not found in context');
    }
    
    try {
        // STEP 1: Create Epic First (if selected)
        if (plan.epic) {
            console.log('Step 1: Creating Epic...');
            
            // Build epic description with acceptance criteria and story links
            let epicDescription = plan.epic.description || plan.epic.title;
            
            // Add acceptance criteria section if available
            if (plan.epic.acceptanceCriteria && plan.epic.acceptanceCriteria.length > 0) {
                epicDescription += '\n\n=== Acceptance Criteria ===\n';
                plan.epic.acceptanceCriteria.forEach((criteria, idx) => {
                    epicDescription += `${idx + 1}. ${criteria}\n`;
                });
            }
            
            // Add story links section if available
            if (plan.epic.storyLinks && plan.epic.storyLinks.length > 0) {
                epicDescription += '\n=== Linked Stories ===\n';
                plan.epic.storyLinks.forEach((link, idx) => {
                    epicDescription += `${idx + 1}. ${link}\n`;
                });
            }
            
            // Build epic fields
            const epicFields = {
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
                                    text: epicDescription
                                }
                            ]
                        }
                    ]
                },
                issuetype: {
                    name: 'Epic'
                }
            };
            
            // Add priority if available (map to Jira priority names)
            if (plan.epic.priority) {
                const priorityMap = {
                    'High': 'High',
                    'Medium': 'Medium',
                    'Low': 'Low',
                    'Lowest': 'Lowest'
                };
                const jiraPriority = priorityMap[plan.epic.priority] || 'Medium';
                epicFields.priority = { name: jiraPriority };
            }
            
            const epicResponse = await api.asUser().requestJira(route`/rest/api/3/issue`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fields: epicFields
                })
            });
            
            if (!epicResponse.ok) {
                const errorText = await epicResponse.text();
                throw new Error(`Failed to create Epic: ${errorText}`);
            }
            
            const epicData = await epicResponse.json();
            epicKey = epicData.key;
            createdIssues.push({ key: epicKey, type: 'Epic', title: plan.epic.title });
            console.log('✓ Created Epic:', epicKey);
        }
        
        // STEP 2: Create Stories (Linked to Epic via parent field)
        if (plan.stories && Array.isArray(plan.stories) && plan.stories.length > 0) {
            console.log(`Step 2: Creating ${plan.stories.length} Stories...`);
            
            for (const story of plan.stories) {
                console.log(`Creating Story: ${story.title}`);
                
                // Build story fields - use parent field to link to Epic
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
                
                // Build story description with acceptance criteria
                let storyDescription = story.description || story.title;
                
                // Add story points if available
                if (story.storyPoints) {
                    storyDescription += `\n\n=== Story Points ===\n${story.storyPoints} (Fibonacci: 1, 2, 3, 5, 8, 13)`;
                }
                
                // Add acceptance criteria section if available
                if (story.acceptanceCriteria && story.acceptanceCriteria.length > 0) {
                    storyDescription += '\n\n=== Acceptance Criteria ===\n';
                    story.acceptanceCriteria.forEach((criteria, idx) => {
                        storyDescription += `${idx + 1}. ${criteria}\n`;
                    });
                }
                
                storyFields.description = {
                    type: 'doc',
                    version: 1,
                    content: [
                        {
                            type: 'paragraph',
                            content: [
                                {
                                    type: 'text',
                                    text: storyDescription
                                }
                            ]
                        }
                    ]
                };
                
                // Add priority if available (map to Jira priority names)
                if (story.priority) {
                    const priorityMap = {
                        'High': 'High',
                        'Medium': 'Medium',
                        'Low': 'Low',
                        'Lowest': 'Lowest'
                    };
                    const jiraPriority = priorityMap[story.priority] || 'Medium';
                    storyFields.priority = { name: jiraPriority };
                }
                
                // Add story points if available (try to use customfield_10016 which is common for Story Points)
                // Note: This field ID may vary by Jira instance, but customfield_10016 is the most common
                if (story.storyPoints) {
                    try {
                        // Try to set story points using common custom field ID
                        storyFields['customfield_10016'] = story.storyPoints;
                        console.log(`Setting Story Points: ${story.storyPoints}`);
                    } catch (error) {
                        console.log(`Could not set Story Points custom field, but it's included in description`);
                    }
                }
                
                // IMPORTANT: Link Story to Epic using parent field (NOT customfield)
                if (epicKey) {
                    storyFields.parent = { key: epicKey };
                    console.log(`Linking Story to Epic: ${epicKey}`);
                }
                
                // Await Story creation
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
                    console.error(`Failed to create Story "${story.title}": ${errorText}`);
                    continue; // Skip to next story if this one fails
                }
                
                const storyData = await storyResponse.json();
                const storyKey = storyData.key;
                createdIssues.push({ key: storyKey, type: 'Story', title: story.title });
                console.log(`✓ Created Story: ${storyKey}`);
            }
        } else {
            console.log('No stories to create (plan.stories is empty or missing)');
        }
        
        console.log(`=== Creation Complete: ${createdIssues.length} issues created ===`);
        
        return {
            success: true,
            createdCount: createdIssues.length,
            message: `Success! Created ${createdIssues.length} items (Epic/Story/Task) in Jira Backlog successfully.`,
            issues: createdIssues
        };
        
    } catch (error) {
        console.error('Error creating issues:', error);
        throw new Error(`Failed to create issues: ${error.message}`);
    }
});

export const handler = resolver.getDefinitions();
