import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DeadlineEmailRequest {
  to: string;
  toName: string;
  subject: string;
  html: string;
  text: string;
  task_name?: string;
  due_date?: string;
  project_name?: string;
}

// HTML escape function for security
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, toName, subject, html, text, task_name, due_date, project_name }: DeadlineEmailRequest = await req.json();

    console.log(`📧 Sending deadline email to: ${to} (${toName})`);
    console.log(`Task: ${task_name}, Due: ${due_date}, Project: ${project_name}`);

    // Sanitize inputs for security
    const safeTaskName = escapeHtml(task_name || '');
    const safeProjectName = escapeHtml(project_name || '');
    const safeToName = escapeHtml(toName || '');

    const emailResponse = await resend.emails.send({
      from: "Project Management <onboarding@resend.dev>",
      to: [to],
      subject: subject || '🚨 Deadline Alert - Action Required',
      html: html || `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Deadline Alert!</h2>
          <p><strong>Task:</strong> ${safeTaskName}</p>
          <p><strong>Due Date:</strong> ${due_date ? new Date(due_date).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }) : 'N/A'}</p>
          ${safeProjectName ? `<p><strong>Project:</strong> ${safeProjectName}</p>` : ''}
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #92400e; margin: 0;"><strong>⚠️ This task is approaching its deadline!</strong></p>
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated reminder from the project management system.
          </p>
        </div>
      `,
      text: text || `Deadline Alert!\n\nTask: ${task_name}\nDue Date: ${due_date}\nProject: ${project_name || 'N/A'}\n\n⚠️ This task is approaching its deadline!`,
    });

    console.log("✅ Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("❌ Error in send-deadline-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
