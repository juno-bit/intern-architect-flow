import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { 
      assignee_id, 
      title, 
      message, 
      due_date,
      task_name,
      project_name 
    } = await req.json();

    console.log(`Processing custom alert for user: ${assignee_id}`);

    // Fetch assignee's email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('user_id', assignee_id)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      throw new Error('Could not find user profile');
    }

    console.log(`Sending alert to: ${profile.email}`);

    // Format the email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Custom Deadline Alert 📅</h2>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; color: #2563eb;">${task_name || 'Task Alert'}</h3>
          ${project_name ? `<p style="margin: 5px 0;"><strong>Project:</strong> ${project_name}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(due_date).toLocaleDateString()}</p>
        </div>

        <div style="margin: 20px 0;">
          <h4 style="color: #374151;">Message:</h4>
          <p style="color: #6b7280;">${message}</p>
        </div>

        <div style="margin: 30px 0; padding: 15px; background: #fef3c7; border-radius: 8px;">
          <p style="margin: 0; font-weight: bold; color: #d97706;">
            ⏰ This is a custom deadline alert from your project manager.
          </p>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          Log in to your dashboard to view more details and manage your tasks.
        </p>
      </div>
    `;

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Task Management <onboarding@resend.dev>",
      to: [profile.email],
      subject: title || `Deadline Alert: ${task_name}`,
      html: emailHtml,
    });

    console.log(`Custom alert email sent successfully to ${profile.email}. Email ID: ${emailResponse.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: emailResponse.id,
        sentTo: profile.email 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-custom-alert function:", error);
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
