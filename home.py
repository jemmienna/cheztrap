from flask import Flask, render_template, request, redirect, url_for
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse

app = Flask(__name__)

#shortens input url to just its domain and path
#ex: www.youtube.com --> youtube.com
def strip_scheme(url):
    parsed_url = urlparse(url)
    netloc = parsed_url.netloc
    if netloc.startswith('www.'):
        netloc = netloc[4:]
    return netloc + parsed_url.path

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/try')
def try_me():
    return redirect('/check')

@app.route('/github')
def github():
    return render_template('github.html')

@app.route('/github')
def github_home():
    return redirect('/')

@app.route('/check')
def checker():
    error = request.args.get('error')
    return render_template('check.html', error=error)

@app.route('/check/result')
def result():
    #sets the url query param
    #/check/result?url=
    url = request.args.get('url')
    stripped_url = strip_scheme(url)

    #sends the form input to urlvoid
    data = {
        'site': stripped_url
    }

    page_to_scrape = requests.post('https://www.urlvoid.com', data=data)

    soup = BeautifulSoup(page_to_scrape.text, 'html.parser')

    detections = 0
    detections = soup.findAll("span", attrs={"class":"label"})
    #if length of detections is equal to 0, an error will pop up because the list is empty
    if len(detections) == 0:
        return redirect('/check?error=invalid_url')
    detection_count = detections[0].text

    #if detection count from urlvoid is 0, then site is safe
    #otherwise, site might be dangerous
    if detection_count == "0/40":
        print("Safe")
    else:
        print("Might be dangerous")
    print(detection_count)

    return render_template('check_result.html', detection_count=detection_count, url=stripped_url)

@app.route('/check?error=invalid_url')
def go_back():
    return redirect('/check')

@app.route('/check/result/chrome')
def chrome_result():
    #sets the url query param
    #/check/result?url=
    url = request.args.get('url')
    stripped_url = strip_scheme(url)

    #sends the form input to urlvoid
    data = {
        'site': stripped_url
    }

    page_to_scrape = requests.post('https://www.urlvoid.com', data=data)

    soup = BeautifulSoup(page_to_scrape.text, 'html.parser')

    detections = 0
    detections = soup.findAll("span", attrs={"class":"label"})
    #if length of detections is equal to 0, an error will pop up because the list is empty
    if len(detections) == 0:
        return redirect('/check?error=invalid_url')
    detection_count = detections[0].text

    #if detection count from urlvoid is 0, then site is safe
    #otherwise, site might be dangerous
    if detection_count == "0/40":
        print("Safe")
    else:
        print("Might be dangerous")
    print(detection_count)

    return render_template('check_result_chrome.html', detection_count=detection_count, url=stripped_url)


if __name__ == "__main__":
    app.run(debug=True)