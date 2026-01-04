import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface MeetingNotificationRequest {
  to: string;
  toName: string;
  meetingDate: string;
  description: string;
  agenda?: string;
  projectName?: string;
  creatorName: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-meeting-notification function invoked");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      to,
      toName,
      meetingDate,
      description,
      agenda,
      projectName,
      creatorName,
    }: MeetingNotificationRequest = await req.json();

    console.log(`Sending meeting notification to ${to}`);

    const formattedDate = new Date(meetingDate).toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const emailResponse = await resend.emails.send({
      from: "Meeting Notifications <onboarding@resend.dev>",
      to: [to],
      subject: `You've been added to a meeting: ${description}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
              .detail-row { margin-bottom: 12px; }
              .label { font-weight: bold; color: #4b5563; }
              .value { color: #1f2937; }
              .agenda-box { background: white; border-left: 4px solid #667eea; padding: 12px; margin: 12px 0; }
              .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">Meeting Invitation</h1>
              </div>
              <div class="content">
                <p>Hello ${toName},</p>
                <p>You have been added as an attendee to a meeting by <strong>${creatorName}</strong>.</p>
                
                <div class="detail-row">
                  <span class="label">📅 Date & Time:</span>
                  <span class="value">${formattedDate}</span>
                </div>
                
                <div class="detail-row">
                  <span class="label">📝 Description:</span>
                  <span class="value">${description}</span>
                </div>
                
                ${projectName ? `
                <div class="detail-row">
                  <span class="label">📁 Project:</span>
                  <span class="value">${projectName}</span>
                </div>
                ` : ""}
                
                ${agenda ? `
                <div class="detail-row">
                  <span class="label">📋 Agenda:</span>
                  <div class="agenda-box">${agenda.replace(/\n/g, "<br>")}</div>
                </div>
                ` : ""}
                
                <p>Please make sure to attend and come prepared.</p>
              </div>
              <div class="footer">
                <p>This is an automated notification from your project management system.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-meeting-notification function:", error);
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
