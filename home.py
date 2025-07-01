from flask import Flask, render_template, request, redirect
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import openai
import os
from urllib.parse import urlparse
import json

app = Flask(__name__)
CORS(app)

#grabs openai api from .env into home.py
load_dotenv()
openai_api_key = os.getenv("OPENAI_API_KEY")
urlvoid_api_key = os.getenv("URLVOID_API_KEY")

def get_completion(prompt, model="gpt-4o"):
   # Prepare the messages for the API call
   messages = [{"role": "user", "content": prompt}]
   # Make the API call
   response = openai.chat.completions.create(
       model=model,
       messages=messages,
       temperature=0
   )
   # Return the content of the response
   return response.choices[0].message.content

# shortens input url to just its domain and path
# ex: www.youtube.com --> youtube.com
def strip_scheme(url):
   parsed_url = urlparse(url)
   netloc = parsed_url.netloc
   if netloc.startswith('www.'):
       netloc = netloc[4:]
   output = netloc + parsed_url.path
   url_parts = output.split('/')
   output = url_parts[0]
   return output

@app.route('/api/check/result/gmail', methods = ["POST"])
def check_result_gmail():

    title = request.form.get("title")
    bodyText = request.form.get("bodyText")

    prompt = f"Answer in a JSON format boolean. The mail is titled {title}. --- The contents of the email consists of: {bodyText}. --- Is this an attempt of a phishing scam? Respond to this question in a format where key is: is_safe and value is boolean, and key is reason and type is string where it explains the reason why it thinks it is safe or not. Return it without the ``` json. Start with just the curly brackets. If it's a popular website always return true."
    ai_response = get_completion(prompt)
    print("ai response: ", ai_response)

    data = json.loads(ai_response)
    is_safe_in_chatgpt = data.get('is_safe')
    reason_in_chatgpt = data.get('reason')
    print(is_safe_in_chatgpt)

    output = {'is_safe': is_safe_in_chatgpt, 'reason': reason_in_chatgpt}
    return output
    # return render_template('/check_result_gmail.html', is_safe_in_chatgpt=is_safe_in_chatgpt)
    
@app.route('/api/check/website', methods=['POST'])
def check_website():
   url = request.form.get('url')
   stripped_url = strip_scheme(url)

   # asks chatgpt if the website is trustable or not
   prompt = build_prompt(stripped_url)
   ai_response = get_completion(prompt)

   print("ai response: ", ai_response)
   print("output:", type(ai_response))

   # gets chatgpt's response
   data = json.loads(ai_response)
   is_safe_in_chatgpt = data.get('is_safe')
   reason_in_chatgpt = data.get('reason')
   print(data)
   print(type(data))

   urlvoid_endpoint = f"https://endpoint.apivoid.com/domainbl/v1/pay-as-you-go/?key={urlvoid_api_key}&host={stripped_url}"
   response = requests.get(urlvoid_endpoint)
   urlvoid_data = response.json()

   # retrieving detection count in urlvoid api
   detection_count = urlvoid_data['data']['report']['blacklists']['detections']

   # if score = 2, it means its super safe. score = 0 means dangerous
   score = 0
   if is_safe_in_chatgpt:
       score += 1
   if detection_count == 0 or detection_count == 1:
       score += 1
   print("website safety score", score)

   output = data
   return output


@app.route('/')
def home():
   return render_template('index.html')

@app.route('/check')
def checker():
   error = request.args.get('error')
   return render_template('check.html', error=error)

@app.route('/check?error=invalid_url')
def go_back():
   return redirect('/check')

@app.route('/privacy')
def privacy_policy():
   return render_template('privacy.html')

@app.route('/terms')
def terms_of_service():
    return render_template('terms.html')

@app.route('/about')
def about_us():
    return render_template('about.html')

@app.route('/contact')
def contact():
    return render_template('contact.html')

def build_prompt(stripped_url: str) -> str:
    return (
        f"Return a JSON object with detailed information about the domain '{stripped_url}'.\n\n"
        "- is_safe: boolean — Is this a scam website?\n"
        "- reason: string — Explanation why it is or isn't safe.\n"
        "- registrar: string — Domain registrar name.\n"
        "- domain_created: string — Domain creation date.\n"\
        "- domain_registrant: string — Name of the domain registrant.\n"
        "- domain_location: string — Geographical region or country of registration.\n"
        "- hq: string — Geographical region or country of the company headquarter.\n"
        "- website_type: string — Type or category of the website (e.g., social media, ecommerce).\n"
        "If the domain is for a popular/trusted website, always set is_safe to true.\n\n"
        "- founded_year: integer — Year the company was founded.\n"
        "- founders: array of strings — Names of the company founders.\n"
        "monthly_visits: integer — Approximate number of monthly visits.\n"
        "traffic_level: string — One of: 'very low', 'low', 'medium', 'high', 'very high'.\n"
        "- money_raised: string — Total amount of money the company has raised (e.g., \"$11.5M\").\n"
        "- fun_fact: string — A fun or surprising fact about the website or company.\n\n"
        "Respond using only raw JSON, starting with '{' and without any backticks or explanation. Don't add ```json in the beginning and the closing."
    )

if __name__ == "__main__":
   app.run(debug=True, host="0.0.0.0", port=8000)

